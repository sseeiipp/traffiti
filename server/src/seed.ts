/**
 * 데모 데이터. 디자인 캔버스의 예시(성수 새벽런, 고래 챌린지 68% 등)를 실제 서비스 로직으로 만든다.
 * 사용법: npm run seed  (DB를 비우고 다시 채운다)
 *
 * 데모 계정(로컬 개발용 테스트 값): doyun@example.com / running123
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { AuthService } from './auth/auth.service.js';
import { ChallengesService } from './challenges/challenges.service.js';
import { CrewsService } from './crews/crews.service.js';
import { DbService } from './db/db.service.js';
import { LatLng } from './geo/geometry.js';
import { RankingsService } from './rankings/rankings.service.js';
import { RunsService } from './runs/runs.service.js';

export const DEMO_PASSWORD = 'running123';
const TERMS = { tos: true, location: true };

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const db = app.get(DbService);
  const auth = app.get(AuthService);
  const crews = app.get(CrewsService);
  const ch = app.get(ChallengesService);
  const runs = app.get(RunsService);
  const rankings = app.get(RankingsService);
  const jwt = (t: string) => JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString()).sub as number;

  await db.pool.query(`TRUNCATE users, crews, challenges, runs, crew_ranking_snapshots, crew_xp_transactions RESTART IDENTITY CASCADE`);

  const user = async (name: string, email: string) =>
    jwt((await auth.signupEmail({ email, password: DEMO_PASSWORD, name, terms: TERMS })).accessToken);

  const doyun = await user('도윤', 'doyun@example.com');
  const jiwoo = await user('지우', 'jiwoo@example.com');
  const minho = await user('민호', 'minho@example.com');
  const seoyeon = await user('서연', 'seoyeon@example.com');

  let runSeq = 0;
  /** 경로의 a~b 비율 구간을 달린 기록을 만든다. daysAgo만큼 과거로 옮긴다. */
  async function runAlong(userId: number, challengeId: number, a: number, b: number, daysAgo = 0, hour = 6) {
    const view = await ch.view(userId, challengeId);
    const route = view.route as LatLng[];
    const i0 = Math.floor(a * (route.length - 1));
    const i1 = Math.floor(b * (route.length - 1));
    const t0 = Date.now() - 2 * 3600_000;
    const pts: { seq: number; lat: number; lng: number; t: number; accuracy: number }[] = [];
    let seq = 0;
    for (let i = i0; i <= i1; i++) {
      for (const f of [0, 0.5]) {
        if (i === i1 && f > 0) break;
        const p = route[i];
        const q = route[Math.min(i + 1, route.length - 1)];
        pts.push({ seq, lat: p[0] + (q[0] - p[0]) * f, lng: p[1] + (q[1] - p[1]) * f, t: t0 + seq * 4000, accuracy: 8 });
        seq++;
      }
    }
    const { id } = await runs.start(userId, { clientId: `seed-${++runSeq}`, challengeId, startedAt: t0 });
    await runs.addPoints(userId, id, pts);
    const s = await runs.finish(userId, id);
    const day = new Date(Date.now() - daysAgo * 86_400_000);
    day.setHours(hour, 4, 0, 0);
    await db.pool.query(
      `UPDATE runs SET started_at = $2::timestamptz, ended_at = $2::timestamptz + (duration_s || ' seconds')::interval WHERE id = $1`,
      [id, day],
    );
    return s;
  }

  async function personalRun(userId: number, km: number, daysAgo: number, hour: number) {
    const { id } = await runs.start(userId, { clientId: `seed-${++runSeq}` });
    const start: LatLng = [37.5446, 127.0559];
    const n = Math.round((km * 1000) / 10);
    const t0 = Date.now() - 3 * 3600_000;
    // 10m씩 천천히 방향을 바꾸며 걷는 경로
    let [lat, lng] = start;
    const pts = Array.from({ length: n }, (_, k) => {
      lat += 0.00009 * Math.cos(k / 40);
      lng += 0.000113 * Math.sin(k / 40);
      return { seq: k, lat, lng, t: t0 + k * 4000, accuracy: 6 };
    });
    await runs.addPoints(userId, id, pts);
    await runs.finish(userId, id);
    const day = new Date(Date.now() - daysAgo * 86_400_000);
    day.setHours(hour, 10, 0, 0);
    await db.pool.query(`UPDATE runs SET started_at = $2::timestamptz, ended_at = $2::timestamptz + (duration_s || ' seconds')::interval WHERE id = $1`, [id, day]);
  }

  /** 끝난 챌린지를 과거 날짜로 옮긴다 */
  async function backdate(challengeId: number, daysAgo: number, status?: string) {
    const end = new Date(Date.now() - daysAgo * 86_400_000);
    const start = new Date(end.getTime() - 6 * 86_400_000);
    await db.pool.query(
      `UPDATE challenges SET start_at = $2, end_at = $3,
         status = COALESCE($4, status),
         completed_at = CASE WHEN COALESCE($4, status) = 'completed' THEN $3 ELSE completed_at END,
         cancelled_at = CASE WHEN COALESCE($4, status) = 'cancelled' THEN $3 ELSE cancelled_at END
       WHERE id = $1`,
      [challengeId, start, end, status ?? null],
    );
  }

  // ---- 성수 새벽런 (도윤의 대표 크루, 크루장 지우) ----
  const ss = await crews.create(jiwoo, { name: '성수 새벽런', region: '성동구 성수동' });
  await db.pool.query(`UPDATE crews SET intro = '평일 새벽 6시, 성수동 골목을 함께 그려요.', created_at = '2026-09-01' WHERE id = $1`, [ss.id]);
  for (const u of [minho, seoyeon, doyun]) await crews.joinByCode(u, ss.inviteCode);

  // 지난 작품: 하트(완성), 별(완성), 토끼(미완료 보관)
  const heart = await ch.create(jiwoo, ss.id, { shapeKey: 'heart' });
  await runAlong(jiwoo, heart.id, 0, 0.5, 13, 7);
  await runAlong(minho, heart.id, 0.5, 1, 12, 7);
  await backdate(heart.id, 12);

  const star = await ch.create(seoyeon, ss.id, { shapeKey: 'star' });
  await runAlong(seoyeon, star.id, 0, 0.35, 30);
  await runAlong(doyun, star.id, 0.35, 0.7, 29);
  await runAlong(jiwoo, star.id, 0.7, 0.97, 28);
  await backdate(star.id, 26, 'completed');

  const rabbit = await ch.create(jiwoo, ss.id, { shapeKey: 'rabbit' });
  await runAlong(minho, rabbit.id, 0, 0.4, 48);
  await runAlong(seoyeon, rabbit.id, 0.4, 0.88, 47);
  await ch.cancel(jiwoo, rabbit.id);
  await backdate(rabbit.id, 47, 'cancelled');

  // 진행 중: 고래 68% (꼬리 구간이 남음)
  const whale = await ch.create(jiwoo, ss.id, { shapeKey: 'whale' });
  await db.pool.query(`UPDATE challenges SET start_at = now() - interval '4 days', end_at = now() + interval '3 days' WHERE id = $1`, [whale.id]);
  await runAlong(jiwoo, whale.id, 0, 0.25, 3);
  await runAlong(minho, whale.id, 0.25, 0.5, 2);
  await runAlong(seoyeon, whale.id, 0.5, 0.68, 1);

  // 도윤의 개인 러닝 (달력)
  await personalRun(doyun, 3.2, 1, 21);
  await personalRun(doyun, 4.3, 6, 6);

  // ---- 회사 점심런 (도윤이 크루장 · 크루장 흐름 확인용) ----
  const co = await crews.create(doyun, { name: '회사 점심런', color: '#C24E0E' });
  const yujin = await user('유진', 'yujin@example.com');
  const taeo = await user('태오', 'taeo@example.com');
  for (const u of [yujin, taeo]) await crews.joinByCode(u, co.inviteCode);
  const coHeart = await ch.create(doyun, co.id, { shapeKey: 'heart' });
  await runAlong(yujin, coHeart.id, 0, 0.45, 5, 12);
  await runAlong(taeo, coHeart.id, 0.45, 0.91, 4, 12);
  await db.pool.query(`UPDATE crews SET join_policy = 'approve' WHERE id = $1`, [co.id]);
  const haeun = await user('하은', 'haeun@example.com');
  await crews.joinByCode(haeun, (await crews.renewInvite(doyun, co.id)).code);

  // ---- 랭킹용 다른 크루 ----
  const others: [string, string, string, [string, number][]][] = [
    ['망원 저녁런', '#2B63F0', '퇴근 후 망원 한강공원에서 함께 그려요.', [['heart', 1], ['star', 0.97]]],
    ['한강 야간러너스', '#0E9384', '한강 다리 아래 밤 러닝.', [['star', 0.96], ['whale', 0.95]]],
    ['서울숲 러닝메이트', '#7A5AF8', '서울숲 한 바퀴부터.', [['heart', 0.91]]],
    ['뚝섬 주말런', '#0891B2', '주말 아침 뚝섬.', [['whale', 0.84]]],
    ['왕십리 퇴근런', '#DB2777', '퇴근길에 한 구간씩.', [['star', 0.61]]],
  ];
  let n = 0;
  for (const [name, color, intro, list] of others) {
    const leader = await user(`리더${++n}`, `leader${n}@example.com`);
    const mate = await user(`크루원${n}`, `mate${n}@example.com`);
    const crew = await crews.create(leader, { name, color });
    await db.pool.query(`UPDATE crews SET intro = $2, artwork_visibility = 'public' WHERE id = $1`, [crew.id, intro]);
    await crews.joinByCode(mate, crew.inviteCode);
    let k = 0;
    for (const [shape, pct] of list) {
      const c = await ch.create(leader, crew.id, { shapeKey: shape });
      await runAlong(leader, c.id, 0, pct / 2, 10 + k);
      await runAlong(mate, c.id, pct / 2, pct, 9 + k);
      if (pct < 0.95) await backdate(c.id, 8 + k, 'expired');
      else await backdate(c.id, 8 + k);
      k += 3;
    }
  }
  await db.pool.query(`UPDATE users SET display_name = '하늘' WHERE email = 'leader1@example.com'`);

  await rankings.recomputeNow();
  const p = await db.one<{ progress: number }>(`SELECT progress FROM challenges WHERE id = $1`, [whale.id]);
  console.log(`seed done · 고래 진행률 ${Math.round(p!.progress * 100)}% · 로그인 doyun@example.com / ${DEMO_PASSWORD}`);
  await app.close();
}

await main();
