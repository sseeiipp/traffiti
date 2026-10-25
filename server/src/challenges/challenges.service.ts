import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import type pg from 'pg';
import { DbService, Queryable } from '../db/db.service.js';
import { CrewsService } from '../crews/crews.service.js';
import { hasBannedWord, pickFreeColor, randomCode } from '../common/util.js';
import { difficultyOf, shapeByKey, SHAPES } from '../geo/shapes.js';
import { LatLng, pathLength, resample } from '../geo/geometry.js';
import { fitToRoads } from '../geo/routing.js';

/** 경로 한 구간의 길이(m). 진행률은 이 단위로 센다. */
export const SEG_M = 20;
/** 닮은 정도가 이보다 낮거나, 길 경로가 그림보다 이 배수 넘게 길면 다시 그리라고 안내한다 */
const REDRAW_SIM = 60;
const REDRAW_STRETCH = 1.6;
/** 지원(시연) 지역: 성동구·광진구 일대 */
export const SUPPORTED = { minLat: 37.525, maxLat: 37.57, minLng: 127.015, maxLng: 127.095 };
export const DEFAULT_START: LatLng = [37.5446, 127.0559]; // 성수역 3번 출구

const inSupported = ([lat, lng]: LatLng) =>
  lat >= SUPPORTED.minLat && lat <= SUPPORTED.maxLat && lng >= SUPPORTED.minLng && lng <= SUPPORTED.maxLng;

const PARTS: Record<string, string[]> = {
  whale: ['머리와 눈', '등과 꼬리 위', '꼬리 아래와 배', '턱과 마무리'],
  heart: ['왼쪽 아래', '왼쪽 위', '오른쪽 위', '오른쪽 아래'],
  star: ['위 꼭짓점', '오른쪽 날개', '아래 두 다리', '왼쪽 날개'],
  rabbit: ['몸 앞', '왼쪽 귀', '오른쪽 귀', '꼬리와 발'],
  cat: ['왼쪽 몸', '왼쪽 귀', '오른쪽 귀', '꼬리와 배'],
};
export const partOf = (shapeKey: string, frac: number) => {
  const parts = PARTS[shapeKey] ?? ['시작 구간', '앞 구간', '뒤 구간', '마무리 구간'];
  return parts[Math.min(parts.length - 1, Math.floor(frac * parts.length))];
};

export interface RouteInput {
  shapeKey?: string;
  customPath?: string;
  start?: LatLng;
  km?: number;
}

@Injectable()
export class ChallengesService {
  constructor(
    private readonly db: DbService,
    private readonly crews: CrewsService,
  ) {}

  library() {
    return SHAPES.map((s) => ({ key: s.key, label: s.label, km: s.km, difficulty: difficultyOf(s.km), library: s.library }));
  }

  /**
   * 경로 제안. 그림을 출발 지점에 맞춰 실제 좌표로 옮긴 뒤, OSRM 도보 경로로 도로를 따라 이어 붙인다.
   * 경로 서버에 닿지 않으면 그림 선을 그대로 쓰고 닮은 정도는 null로 둔다.
   */
  async suggest(input: RouteInput) {
    const start = input.start ?? DEFAULT_START;
    const custom = !!input.customPath;
    const shape = custom ? null : shapeByKey(input.shapeKey ?? '');
    if (!custom && !shape) throw new BadRequestException('그림을 골라 주세요.');
    if (custom && !inSupported(start)) {
      return {
        ok: false as const,
        reason: '직접 그린 그림은 지원 지역(성동구·광진구 일대) 안에서만 경로로 만들 수 있어요.',
        alternatives: ['그림을 조금 옮기거나 줄이기', '다른 지역에서 찾기', '비슷한 검증된 코스 보기'],
      };
    }
    const km = Math.min(15, Math.max(1, input.km ?? shape?.km ?? 5));
    const fit = await fitToRoads(custom ? input.customPath! : shape!.path, start, km * 1000);
    const route = resample(fit.road ?? fit.shape, SEG_M);
    const meters = pathLength(route);
    // 길이 끊기거나, 그림과 많이 다르거나, 돌아가느라 길이가 크게 늘면 이상한 경로를 보여주지 않고 다시 그리게 한다
    const stretch = fit.road ? meters / Math.max(1, pathLength(fit.shape)) : 0;
    if (!fit.road || fit.similarity == null || fit.similarity < REDRAW_SIM || stretch > REDRAW_STRETCH) {
      return {
        ok: false as const,
        reason: !fit.road
          ? '그림을 이어 줄 길을 찾지 못했어요. 길이 많은 곳에서 그림을 조금 단순하게 다시 그려 주세요.'
          : custom
            ? '길로 옮기면 그림이 꼬이거나 많이 달라져요. 선을 조금 단순하고 크게 다시 그려 주세요.'
            : '이 출발 지점에서는 길로 옮기면 그림이 많이 달라져요. 출발 지점을 옮기거나 다른 그림을 골라 주세요.',
        alternatives: custom
          ? ['그림 다시 그리기', '출발 지점 옮기기', '비슷한 검증된 코스 보기']
          : ['다른 그림 고르기', '출발 지점 옮기기', '비슷한 검증된 코스 보기'],
        similarity: fit.similarity,
      };
    }
    const notes: string[] = [];
    {
      const m = fit.movedM, d = Math.abs(fit.rotatedDeg ?? 0);
      if (m && d) notes.push(`길에 잘 맞도록 그림을 ${m}m 옮기고 ${d}° 돌려 놓았어요.`);
      else if (m) notes.push(`길에 잘 맞도록 그림을 ${m}m 옮겨 놓았어요.`);
      else if (d) notes.push(`길에 잘 맞도록 그림을 ${d}° 돌려 놓았어요.`);
      if (fit.similarity! < 70) notes.push('길이 없는 곳은 가까운 도로로 돌아가서 그림과 다른 곳이 있어요.');
    }
    return {
      ok: true as const,
      route,
      distanceKm: Math.round(meters / 100) / 10,
      difficulty: difficultyOf(meters / 1000),
      similarity: fit.similarity,
      // 앱이 제안 경로 아래에 원래 그림을 겹쳐 보여줄 수 있게 함께 보낸다
      target: fit.road ? resample(fit.shape, SEG_M) : null,
      notes,
    };
  }

  async create(
    userId: number,
    crewId: number,
    b: RouteInput & {
      title?: string;
      startDate?: string;
      endDate?: string;
      visibility?: string;
      gpsVisibility?: string;
      areaLabel?: string;
      startLabel?: string;
      drawingMode?: 'library' | 'map' | 'sketch';
    },
  ) {
    const role = await this.crews.assertMember(userId, crewId);
    const crew = await this.db.one<{ challenge_permission: string; artwork_visibility: string }>(
      `SELECT challenge_permission, artwork_visibility FROM crews WHERE id = $1`,
      [crewId],
    );
    if (crew?.challenge_permission === 'leader' && role !== 'leader') {
      throw new ForbiddenException('이 크루는 크루장만 챌린지를 만들 수 있어요.');
    }
    const r = await this.suggest(b);
    if (!r.ok) throw new BadRequestException(r.reason);
    const shapeKey = b.customPath ? 'custom' : b.shapeKey!;
    const title = b.customPath ? '직접 그린 코스' : `${shapeByKey(shapeKey)!.label} 챌린지`;
    const startAt = b.startDate ? new Date(b.startDate) : new Date();
    const endAt = b.endDate ? new Date(b.endDate) : new Date(startAt.getTime() + 7 * 86_400_000);
    if (endAt <= startAt) throw new BadRequestException('기간을 다시 확인해 주세요.');
    return this.db.tx(async (c) => {
      try {
        const row = await this.db.one<{ id: number }>(
          `INSERT INTO challenges (crew_id, created_by, shape_key, title, drawing_mode, start_at, end_at, visibility, gps_visibility,
             area_label, start_label, target_distance_m, difficulty, route_points)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id`,
          [
            crewId,
            userId,
            shapeKey,
            title,
            b.drawingMode ?? (b.customPath ? 'map' : 'library'),
            startAt,
            endAt,
            b.visibility ?? crew?.artwork_visibility ?? 'crew',
            b.gpsVisibility ?? 'me',
            b.areaLabel ?? '성수동 일대',
            b.startLabel ?? '성수역 3번 출구',
            Math.round(r.distanceKm * 1000),
            r.difficulty,
            JSON.stringify(r.route),
          ],
          c,
        );
        return { id: row!.id };
      } catch (e: any) {
        if (e.code === '23505') throw new ConflictException('진행 중인 챌린지가 이미 있어요. 크루당 하나씩만 진행할 수 있어요.');
        throw e;
      }
    });
  }

  async current(userId: number, crewId: number) {
    await this.crews.assertMember(userId, crewId);
    const row = await this.db.one<{ id: number }>(`SELECT id FROM challenges WHERE crew_id = $1 AND status = 'active'`, [crewId]);
    return row ? this.view(userId, row.id) : null;
  }

  private async canView(userId: number, ch: any, db: Queryable = this.db.pool) {
    if (ch.crew_id) {
      if (await this.crews.role(userId, ch.crew_id, db)) return true;
      const crew = await this.db.one<{ artwork_visibility: string }>(`SELECT artwork_visibility FROM crews WHERE id = $1`, [ch.crew_id], db);
      return ch.status !== 'active' && (ch.visibility === 'public' || crew?.artwork_visibility === 'public');
    }
    return !!(await this.db.one(`SELECT 1 FROM challenge_participations WHERE challenge_id = $1 AND user_id = $2`, [ch.id, userId], db));
  }

  /** 챌린지·작품 화면에서 쓰는 공통 모양. 원본 GPS가 아니라 목표 경로의 구간별 주인만 담는다. */
  async view(userId: number, id: number, db: Queryable = this.db.pool) {
    const ch = await this.db.one(
      `SELECT ch.*, u.display_name AS creator_name, c.name AS crew_name FROM challenges ch
       LEFT JOIN users u ON u.id = ch.created_by LEFT JOIN crews c ON c.id = ch.crew_id WHERE ch.id = $1`,
      [id],
      db,
    );
    if (!ch) throw new NotFoundException('챌린지를 찾을 수 없어요.');
    if (!(await this.canView(userId, ch, db))) throw new ForbiddenException('볼 수 없는 챌린지예요.');
    const route: LatLng[] = ch.route_points;
    const segCount = route.length - 1;
    const cov = await this.db.many<{ seg_index: number; user_id: number | null; color: string }>(
      `SELECT seg_index, user_id, color FROM challenge_coverage WHERE challenge_id = $1 ORDER BY seg_index`,
      [id],
      db,
    );
    // 크루를 나갔거나 계정을 지운 사람의 구간은 '나간 크루원'
    const people = await this.db.many<{ id: number; name: string; active: boolean }>(
      ch.crew_id
        ? `SELECT u.id, u.display_name AS name, (u.deleted_at IS NULL AND EXISTS (
             SELECT 1 FROM crew_members m WHERE m.crew_id = $2 AND m.user_id = u.id AND m.left_at IS NULL)) AS active
           FROM users u WHERE u.id = ANY($1)`
        : `SELECT u.id, u.display_name AS name, (u.deleted_at IS NULL) AS active FROM users u WHERE u.id = ANY($1)`,
      ch.crew_id ? [[...new Set(cov.map((c) => c.user_id))], ch.crew_id] : [[...new Set(cov.map((c) => c.user_id))]],
      db,
    );
    const nameOf = (uid: number | null) => {
      const p = people.find((x) => x.id === uid);
      return p && p.active ? p.name : '나간 크루원';
    };
    const segs: (null | { userId: number | null; color: string })[] = Array(segCount).fill(null);
    for (const c of cov) segs[c.seg_index] = { userId: c.user_id, color: c.color };

    // 사람별 기여(거리, 맡은 부분)
    const byUser = new Map<string, { userId: number | null; name: string; color: string; segs: number[] }>();
    cov.forEach((c) => {
      const key = String(c.user_id);
      if (!byUser.has(key)) byUser.set(key, { userId: c.user_id, name: nameOf(c.user_id), color: c.color, segs: [] });
      byUser.get(key)!.segs.push(c.seg_index);
    });
    const contributors = [...byUser.values()].map((u) => {
      const mid = u.segs[Math.floor(u.segs.length / 2)] / segCount;
      return {
        userId: u.userId,
        name: u.name,
        isMe: u.userId === userId,
        color: u.color,
        km: Math.round((u.segs.length * SEG_M) / 100) / 10,
        share: u.segs.length / segCount,
        part: partOf(ch.shape_key, mid),
      };
    });
    // 이어 달리기: 서로 다른 사람의 구간이 맞닿은 횟수
    let relays = 0;
    for (let i = 1; i < segCount; i++) if (segs[i] && segs[i - 1] && segs[i]!.userId !== segs[i - 1]!.userId) relays++;

    const members = ch.crew_id
      ? await this.db.many<{ id: number; name: string; color: string }>(
          `SELECT u.id, u.display_name AS name, m.record_color AS color FROM crew_members m JOIN users u ON u.id = m.user_id
           WHERE m.crew_id = $1 AND m.left_at IS NULL`,
          [ch.crew_id],
          db,
        )
      : await this.db.many<{ id: number; name: string; color: string }>(
          `SELECT u.id, u.display_name AS name, p.color FROM challenge_participations p JOIN users u ON u.id = p.user_id WHERE p.challenge_id = $1`,
          [id],
          db,
        );
    const covered = cov.length;
    const remainingKm = Math.round(((segCount - covered) * SEG_M) / 100) / 10;
    const me = members.find((m) => m.id === userId);
    const firstGap = segs.findIndex((s) => !s);
    return {
      id: ch.id,
      crewId: ch.crew_id,
      crewName: ch.crew_name,
      isFriend: !ch.crew_id,
      friendCode: ch.friend_code,
      shapeKey: ch.shape_key,
      title: ch.title,
      category: ch.category,
      name: ch.category ?? (ch.shape_key === 'custom' ? '직접 그린 코스' : shapeByKey(ch.shape_key)?.label ?? ch.title),
      status: ch.status,
      creatorId: ch.created_by,
      creatorName: ch.creator_name,
      startAt: ch.start_at,
      endAt: ch.end_at,
      extended: !!ch.extended_at,
      timeUp: ch.status === 'active' && new Date(ch.end_at).getTime() <= Date.now(),
      daysLeft: Math.max(0, Math.ceil((new Date(ch.end_at).getTime() - Date.now()) / 86_400_000)),
      visibility: ch.visibility,
      gpsVisibility: ch.gps_visibility,
      areaLabel: ch.area_label,
      startLabel: ch.start_label,
      distanceKm: Math.round(ch.target_distance_m / 100) / 10,
      difficulty: ch.difficulty,
      progress: ch.progress,
      remainingKm,
      remainingPart: firstGap >= 0 ? partOf(ch.shape_key, firstGap / segCount) : null,
      completedAt: ch.completed_at,
      cancelledAt: ch.cancelled_at,
      route,
      segments: segs.map((s) => (s ? s.color : null)),
      contributors,
      participants: members.length,
      joined: contributors.filter((c) => c.userId != null).length,
      relays,
      myColor: me?.color ?? null,
      members: members.map((m) => ({ id: m.id, name: m.name, color: m.color })),
    };
  }

  async cancel(userId: number, id: number) {
    const ch = await this.db.one<{ crew_id: number; status: string }>(`SELECT crew_id, status FROM challenges WHERE id = $1`, [id]);
    if (!ch) throw new NotFoundException('챌린지를 찾을 수 없어요.');
    if (!ch.crew_id) throw new BadRequestException('친구 챌린지는 중단할 수 없어요.');
    await this.crews.assertLeader(userId, ch.crew_id);
    if (ch.status !== 'active') throw new ConflictException('이미 끝난 챌린지예요. 중단한 챌린지는 다시 열 수 없어요.');
    await this.db.pool.query(`UPDATE challenges SET status = 'cancelled', cancelled_at = now() WHERE id = $1`, [id]);
    return this.view(userId, id);
  }

  async setCategory(userId: number, id: number, name: string) {
    const n = (name ?? '').trim();
    if (!n || n.length > 12) throw new BadRequestException('그림 이름은 1–12자예요.');
    if (hasBannedWord(n)) throw new BadRequestException('쓸 수 없는 단어가 들어 있어요.');
    const ch = await this.db.one<{ crew_id: number; created_by: number }>(`SELECT crew_id, created_by FROM challenges WHERE id = $1`, [id]);
    if (!ch) throw new NotFoundException('챌린지를 찾을 수 없어요.');
    const role = ch.crew_id ? await this.crews.role(userId, ch.crew_id) : null;
    if (ch.created_by !== userId && role !== 'leader') throw new ForbiddenException('만든 사람이나 크루장만 이름을 정할 수 있어요.');
    await this.db.pool.query(`UPDATE challenges SET category = $2 WHERE id = $1`, [id, n]);
    return { category: n };
  }

  async categories() {
    const rows = await this.db.many<{ category: string; teams: number }>(
      `SELECT category, count(DISTINCT crew_id)::int AS teams FROM challenges WHERE category IS NOT NULL GROUP BY category ORDER BY teams DESC LIMIT 8`,
    );
    return rows;
  }

  // ---- 친구 챌린지 ----

  /** 친구 챌린지 기간은 오늘 24시(한국 시간)까지로 고정 */
  async createFriend(userId: number, b: { shapeKey: string; start?: LatLng }) {
    const shape = shapeByKey(b.shapeKey);
    if (!shape) throw new BadRequestException('그림을 골라 주세요.');
    const r = await this.suggest({ shapeKey: b.shapeKey, start: b.start });
    if (!r.ok) throw new BadRequestException(r.reason);
    return this.db.tx(async (c) => {
      for (let i = 0; i < 20; i++) {
        const code = randomCode();
        const row = await c.query(
          `INSERT INTO challenges (friend_code, created_by, shape_key, title, start_at, end_at, target_distance_m, difficulty, route_points, area_label, start_label)
           VALUES ($1,$2,$3,$4, now(), (date_trunc('day', now() AT TIME ZONE 'Asia/Seoul') + interval '1 day') AT TIME ZONE 'Asia/Seoul', $5, $6, $7, '지금 위치 근처', '지금 위치')
           ON CONFLICT DO NOTHING RETURNING id`,
          [code, userId, shape.key, `${shape.label} 챌린지`, Math.round(r.distanceKm * 1000), r.difficulty, JSON.stringify(r.route)],
        );
        if (row.rowCount) {
          await c.query(`INSERT INTO challenge_participations (challenge_id, user_id, color) VALUES ($1, $2, '#7A5AF8')`, [
            row.rows[0].id,
            userId,
          ]);
          return { id: row.rows[0].id as number, code };
        }
      }
      throw new ConflictException('코드를 만들지 못했어요.');
    });
  }

  async previewFriend(code: string) {
    const ch = await this.db.one(
      `SELECT ch.id, ch.shape_key, ch.end_at, ch.target_distance_m, u.display_name AS creator,
              (SELECT count(*)::int FROM challenge_participations p WHERE p.challenge_id = ch.id) AS joined
       FROM challenges ch JOIN users u ON u.id = ch.created_by
       WHERE ch.friend_code = $1 AND ch.status = 'active' AND ch.end_at > now()`,
      [code],
    );
    if (!ch) throw new NotFoundException('코드를 다시 확인해 주세요.');
    return {
      id: ch.id,
      shapeKey: ch.shape_key,
      title: `${ch.creator}님의 ${shapeByKey(ch.shape_key)?.label ?? ''} 챌린지`,
      joined: ch.joined,
      daysLeft: Math.max(0, Math.ceil((new Date(ch.end_at).getTime() - Date.now()) / 86_400_000)),
      distanceKm: Math.round(ch.target_distance_m / 100) / 10,
    };
  }

  async joinFriend(userId: number, code: string) {
    return this.db.tx(async (c) => {
      const ch = await this.db.one<{ id: number }>(
        `SELECT id FROM challenges WHERE friend_code = $1 AND status = 'active' AND end_at > now() FOR UPDATE`,
        [code],
        c,
      );
      if (!ch) throw new NotFoundException('코드를 다시 확인해 주세요.');
      const parts = await this.db.many<{ user_id: number; color: string }>(
        `SELECT user_id, color FROM challenge_participations WHERE challenge_id = $1`,
        [ch.id],
        c,
      );
      if (parts.some((p) => p.user_id === userId)) return { id: ch.id };
      if (parts.length >= 6) throw new ConflictException('이미 6명이 모였어요.');
      await c.query(`INSERT INTO challenge_participations (challenge_id, user_id, color) VALUES ($1, $2, $3)`, [
        ch.id,
        userId,
        pickFreeColor(parts.map((p) => p.color)),
      ]);
      return { id: ch.id };
    });
  }

  /** 내가 참여한 진행 중 친구 챌린지(홈 맨 위 카드). 시간이 끝나도 저장·연장을 고를 때까지 남는다. */
  async currentFriend(userId: number) {
    const row = await this.db.one<{ id: number }>(
      `SELECT ch.id FROM challenges ch JOIN challenge_participations p ON p.challenge_id = ch.id AND p.user_id = $1
       WHERE ch.crew_id IS NULL AND ch.status = 'active' ORDER BY ch.end_at DESC LIMIT 1`,
      [userId],
    );
    return row ? this.view(userId, row.id) : null;
  }

  private async friendForAction(userId: number, id: number) {
    const ch = await this.db.one<{ crew_id: number | null; status: string; extended_at: string | null; end_at: string }>(
      `SELECT crew_id, status, extended_at, end_at FROM challenges WHERE id = $1`,
      [id],
    );
    if (!ch || ch.crew_id) throw new NotFoundException('친구 챌린지를 찾을 수 없어요.');
    if (!(await this.db.one(`SELECT 1 FROM challenge_participations WHERE challenge_id = $1 AND user_id = $2`, [id, userId])))
      throw new ForbiddenException('참여한 사람만 할 수 있어요.');
    if (ch.status !== 'active') throw new ConflictException('이미 끝난 챌린지예요.');
    return ch;
  }

  /** 시간이 끝난 친구 챌린지를 내일 24시까지 한 번만 연장 */
  async extendFriend(userId: number, id: number) {
    const ch = await this.friendForAction(userId, id);
    if (ch.extended_at) throw new ConflictException('연장은 한 번만 할 수 있어요.');
    if (new Date(ch.end_at).getTime() > Date.now()) throw new ConflictException('아직 시간이 남아 있어요.');
    await this.db.pool.query(`UPDATE challenges SET end_at = end_at + interval '1 day', extended_at = now() WHERE id = $1`, [id]);
    return this.view(userId, id);
  }

  /** 달린 만큼 저장: 미완료 작품으로 보관 */
  async finishFriend(userId: number, id: number) {
    await this.friendForAction(userId, id);
    await this.db.pool.query(`UPDATE challenges SET status = 'expired', end_at = LEAST(end_at, now()) WHERE id = $1`, [id]);
    return this.view(userId, id);
  }

  /** 친구 챌린지 → 크루. 만든 사람이 크루장이 되고, 다른 참여자에게는 초대가 간다. 작품과 XP는 새 크루로 옮긴다. */
  async friendToCrew(userId: number, id: number, name: string) {
    const ch = await this.db.one<{ created_by: number; crew_id: number | null; shape_key: string; status: string; progress: number }>(
      `SELECT created_by, crew_id, shape_key, status, progress FROM challenges WHERE id = $1`,
      [id],
    );
    if (!ch || ch.crew_id) throw new NotFoundException('친구 챌린지를 찾을 수 없어요.');
    if (ch.created_by !== userId) throw new ForbiddenException('챌린지를 만든 사람만 크루로 만들 수 있어요.');
    const { id: crewId } = await this.crews.create(userId, { name });
    await this.db.tx(async (c) => {
      const parts = await this.db.many<{ user_id: number }>(
        `SELECT user_id FROM challenge_participations WHERE challenge_id = $1 AND user_id <> $2`,
        [id, userId],
        c,
      );
      for (const p of parts) {
        await c.query(`INSERT INTO crew_join_requests (crew_id, user_id, status) VALUES ($1, $2, 'invited')`, [crewId, p.user_id]);
      }
      const status = ch.status === 'active' ? 'completed' : ch.status;
      await c.query(`UPDATE challenges SET crew_id = $2, friend_code = NULL, status = $3, completed_at = COALESCE(completed_at, now()) WHERE id = $1`, [
        id,
        crewId,
        status,
      ]);
      // 친구 챌린지 동안의 거리 XP를 다음 집계부터 새 크루에 넣는다
      const km = await this.db.one<{ m: number }>(`SELECT COALESCE(sum(distance_m), 0) AS m FROM runs WHERE challenge_id = $1 AND status = 'saved'`, [id], c);
      await this.addXp(c, crewId, id, 'friend_transfer', String(id), Math.floor(Number(km!.m) / 1000) * 10);
      if (ch.progress >= 0.95) await this.addXp(c, crewId, id, 'artwork', String(id), 200);
    });
    return { crewId };
  }

  async addXp(c: Queryable, crewId: number | null, challengeId: number | null, type: string, sourceId: string, amount: number) {
    if (!crewId || amount <= 0) return;
    await c.query(
      `INSERT INTO crew_xp_transactions (crew_id, challenge_id, source_type, source_id, xp_amount) VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (source_type, source_id) DO NOTHING`,
      [crewId, challengeId, type, sourceId, amount],
    );
  }

  // ---- 작품·갤러리 ----

  async artworks(userId: number, scope: 'all' | 'crew' | 'mine', crewId?: number) {
    let rows: { id: number }[];
    if (scope === 'mine') {
      rows = await this.db.many(
        `SELECT DISTINCT ch.id, COALESCE(ch.completed_at, ch.cancelled_at, ch.end_at) AS at FROM challenges ch
         JOIN challenge_coverage cv ON cv.challenge_id = ch.id AND cv.user_id = $1
         WHERE ch.status IN ('completed','cancelled','expired') ORDER BY at DESC LIMIT 60`,
        [userId],
      );
    } else if (scope === 'crew') {
      const id = crewId ?? (await this.crews.primaryCrewId(userId));
      if (!id) return [];
      await this.crews.assertMember(userId, id);
      rows = await this.db.many(
        `SELECT id FROM challenges WHERE crew_id = $1 AND status IN ('completed','cancelled','expired')
         ORDER BY COALESCE(completed_at, cancelled_at, end_at) DESC LIMIT 60`,
        [id],
      );
    } else {
      rows = await this.db.many(
        `SELECT ch.id FROM challenges ch LEFT JOIN crews c ON c.id = ch.crew_id
         WHERE ch.status IN ('completed','cancelled','expired') AND (
           EXISTS (SELECT 1 FROM crew_members m WHERE m.crew_id = ch.crew_id AND m.user_id = $1 AND m.left_at IS NULL)
           OR EXISTS (SELECT 1 FROM challenge_participations p WHERE p.challenge_id = ch.id AND p.user_id = $1)
           OR (c.deleted_at IS NULL AND (ch.visibility = 'public' OR c.artwork_visibility = 'public')))
         ORDER BY COALESCE(ch.completed_at, ch.cancelled_at, ch.end_at) DESC LIMIT 60`,
        [userId],
      );
    }
    const out = [];
    for (const r of rows) {
      const v = await this.view(userId, r.id);
      const mine = !!(v.crewId && (await this.crews.role(userId, v.crewId)));
      out.push({
        id: v.id,
        name: v.name,
        crewName: v.crewName,
        isOurs: mine || v.isFriend,
        status: v.status,
        progress: v.progress,
        endedAt: v.completedAt ?? v.cancelledAt ?? v.endAt,
        route: v.route,
        segments: v.segments,
      });
    }
    return out;
  }

  /**
   * 챌린지 기간이 끝나면 완성 기준을 못 넘긴 것은 미완료로 보관한다.
   * 친구 챌린지는 연장 전이면 하루 더 기다린다(그동안 34 화면에서 저장·연장을 고른다).
   */
  @Cron('0 */10 * * * *')
  async expire() {
    await this.db.pool.query(
      `UPDATE challenges SET status = 'expired' WHERE status = 'active' AND end_at < now()
         AND (crew_id IS NOT NULL OR extended_at IS NOT NULL OR end_at < now() - interval '1 day')`,
    );
  }
}

export type ChallengeView = Awaited<ReturnType<ChallengesService['view']>>;
export type Tx = pg.PoolClient;
