import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DbService } from '../db/db.service.js';
import { ChallengesService, partOf, SEG_M } from '../challenges/challenges.service.js';
import { analyzeRun, COMPLETE_RATIO, coveredSegments, LatLng, RunPoint } from '../geo/geometry.js';
import { shapeByKey } from '../geo/shapes.js';

interface PointIn {
  seq: number;
  lat: number;
  lng: number;
  t: number;
  accuracy?: number | null;
}

@Injectable()
export class RunsService {
  constructor(
    private readonly db: DbService,
    private readonly challenges: ChallengesService,
  ) {}

  /** 러닝 시작. clientId가 같으면 같은 러닝을 돌려줘서 재시도해도 중복이 생기지 않는다. */
  async start(userId: number, b: { clientId: string; challengeId?: number | null; startedAt?: number }) {
    if (!b.clientId) throw new BadRequestException('clientId가 필요해요.');
    const existing = await this.db.one(`SELECT id, user_id FROM runs WHERE client_id = $1`, [b.clientId]);
    if (existing) {
      if (existing.user_id !== userId) throw new ForbiddenException();
      return { id: existing.id };
    }
    let crewId: number | null = null;
    if (b.challengeId) {
      const ch = await this.db.one<{ crew_id: number | null; status: string; start_at: string; end_at: string }>(
        `SELECT crew_id, status, start_at, end_at FROM challenges WHERE id = $1`,
        [b.challengeId],
      );
      if (!ch) throw new NotFoundException('챌린지를 찾을 수 없어요.');
      if (ch.status !== 'active') throw new ConflictException('끝난 챌린지예요.');
      const now = Date.now();
      if (now < new Date(ch.start_at).getTime() || now > new Date(ch.end_at).getTime()) {
        throw new ConflictException('챌린지 기간이 아니에요.');
      }
      if (ch.crew_id) {
        const m = await this.db.one(`SELECT 1 FROM crew_members WHERE crew_id = $1 AND user_id = $2 AND left_at IS NULL`, [ch.crew_id, userId]);
        if (!m) throw new ForbiddenException('이 크루의 크루원만 참여할 수 있어요.');
        crewId = ch.crew_id;
      } else {
        const p = await this.db.one(`SELECT 1 FROM challenge_participations WHERE challenge_id = $1 AND user_id = $2`, [b.challengeId, userId]);
        if (!p) throw new ForbiddenException('코드로 먼저 참여해 주세요.');
      }
    }
    const row = await this.db.one<{ id: number }>(
      `INSERT INTO runs (client_id, user_id, challenge_id, crew_id, started_at) VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (client_id) DO UPDATE SET client_id = EXCLUDED.client_id RETURNING id`,
      [b.clientId, userId, b.challengeId ?? null, crewId, new Date(b.startedAt ?? Date.now())],
    );
    return { id: row!.id };
  }

  private async own(userId: number, runId: number) {
    const run = await this.db.one(`SELECT * FROM runs WHERE id = $1`, [runId]);
    if (!run) throw new NotFoundException('기록을 찾을 수 없어요.');
    if (run.user_id !== userId) throw new ForbiddenException('내 기록만 볼 수 있어요.');
    return run;
  }

  async addPoints(userId: number, runId: number, points: PointIn[]) {
    const run = await this.own(userId, runId);
    if (run.status !== 'recording') return { accepted: 0 };
    const clean = (points ?? []).filter(
      (p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180 && Number.isInteger(p.seq),
    );
    if (!clean.length) return { accepted: 0 };
    const vals: unknown[] = [runId];
    const rows = clean.map((p) => {
      vals.push(p.seq, p.lat, p.lng, new Date(p.t), p.accuracy ?? null);
      const k = vals.length;
      return `($1, $${k - 4}, $${k - 3}, $${k - 2}, $${k - 1}, $${k})`;
    });
    const r = await this.db.pool.query(
      `INSERT INTO run_points (run_id, seq, lat, lng, recorded_at, accuracy_m) VALUES ${rows.join(',')} ON CONFLICT DO NOTHING`,
      vals,
    );
    return { accepted: r.rowCount };
  }

  /**
   * 러닝 종료. 저장된 점으로 거리·시간을 다시 계산하고(클라이언트 값을 믿지 않는다),
   * 챌린지 러닝이면 구간을 채워 진행률과 XP를 반영한다. 여러 번 불러도 결과가 같다.
   */
  async finish(userId: number, runId: number) {
    const run = await this.own(userId, runId);
    if (run.status === 'saved') return this.summary(userId, runId);
    return this.db.tx(async (c) => {
      await c.query('SELECT id FROM runs WHERE id = $1 FOR UPDATE', [runId]);
      const pts = await this.db.many<{ lat: number; lng: number; recorded_at: string; accuracy_m: number | null }>(
        `SELECT lat, lng, recorded_at, accuracy_m FROM run_points WHERE run_id = $1 ORDER BY seq`,
        [runId],
        c,
      );
      const points: RunPoint[] = pts.map((p) => ({ lat: p.lat, lng: p.lng, t: new Date(p.recorded_at).getTime(), accuracy: p.accuracy_m }));
      const stats = analyzeRun(points);
      const endedAt = points.length ? new Date(points[points.length - 1].t) : new Date();
      let before: number | null = null;
      let after: number | null = null;
      let segmentLabel: string | null = null;
      let completed = false;

      if (run.challenge_id) {
        const ch = await this.db.one(`SELECT * FROM challenges WHERE id = $1 FOR UPDATE`, [run.challenge_id], c);
        if (ch && ch.status === 'active') {
          const route: LatLng[] = ch.route_points;
          const segCount = route.length - 1;
          before = ch.progress;
          const color = ch.crew_id
            ? (await this.db.one<{ record_color: string }>(
                `SELECT record_color FROM crew_members WHERE crew_id = $1 AND user_id = $2 AND left_at IS NULL`,
                [ch.crew_id, userId],
                c,
              ))?.record_color ?? '#7A5AF8'
            : (await this.db.one<{ color: string }>(
                `SELECT color FROM challenge_participations WHERE challenge_id = $1 AND user_id = $2`,
                [ch.id, userId],
                c,
              ))?.color ?? '#7A5AF8';
          const hit = coveredSegments(route, stats.validPoints);
          if (hit.length) {
            const vals: unknown[] = [ch.id, userId, runId, color];
            const rows = hit.map((i) => {
              vals.push(i);
              return `($1, $${vals.length}, $2, $3, $4)`;
            });
            await c.query(
              `INSERT INTO challenge_coverage (challenge_id, seg_index, user_id, run_id, color) VALUES ${rows.join(',')} ON CONFLICT DO NOTHING`,
              vals,
            );
            segmentLabel = partOf(ch.shape_key, hit[Math.floor(hit.length / 2)] / segCount);
          }
          const n = await this.db.one<{ n: number }>(`SELECT count(*)::int AS n FROM challenge_coverage WHERE challenge_id = $1`, [ch.id], c);
          after = n!.n / segCount;
          completed = after >= COMPLETE_RATIO;
          await c.query(
            `UPDATE challenges SET progress = $2, status = CASE WHEN $3 THEN 'completed' ELSE status END,
               completed_at = CASE WHEN $3 THEN now() ELSE completed_at END WHERE id = $1`,
            [ch.id, after, completed],
          );
          if (ch.crew_id) {
            await this.challenges.addXp(c, ch.crew_id, ch.id, 'run_km', String(runId), Math.floor(stats.distanceM / 1000) * 10);
            if (completed) {
              await this.challenges.addXp(c, ch.crew_id, ch.id, 'artwork', String(ch.id), 200);
              const all = await this.db.one<{ missing: number }>(
                `SELECT count(*)::int AS missing FROM crew_members m WHERE m.crew_id = $1 AND m.left_at IS NULL
                 AND NOT EXISTS (SELECT 1 FROM challenge_coverage cv WHERE cv.challenge_id = $2 AND cv.user_id = m.user_id)`,
                [ch.crew_id, ch.id],
                c,
              );
              if (all!.missing === 0) await this.challenges.addXp(c, ch.crew_id, ch.id, 'all_joined', String(ch.id), 100);
            }
          }
        }
      }
      // 개인 러닝은 어느 크루 XP에도 넣지 않는다(시작한 챌린지 하나에만 반영 규칙)

      await c.query(
        `UPDATE runs SET status = 'saved', ended_at = $2, distance_m = $3, duration_s = $4, gap_count = $5, gap_seconds = $6,
           segment_label = $7, progress_before = $8, progress_after = $9 WHERE id = $1`,
        [runId, endedAt, stats.distanceM, stats.durationS, stats.gapCount, stats.gapSeconds, segmentLabel, before, after],
      );
      return this.summary(userId, runId, c);
    });
  }

  async summary(userId: number, runId: number, db = this.db.pool as any) {
    const run = await this.db.one(
      `SELECT r.*, ch.title AS challenge_title, ch.shape_key, ch.status AS challenge_status, ch.created_by AS challenge_creator,
              ch.category, ch.crew_id AS ch_crew, ch.route_points, ch.progress AS challenge_progress
       FROM runs r LEFT JOIN challenges ch ON ch.id = r.challenge_id WHERE r.id = $1`,
      [runId],
      db,
    );
    if (!run || run.user_id !== userId) throw new NotFoundException('기록을 찾을 수 없어요.');
    const segCount = run.route_points ? run.route_points.length - 1 : 0;
    const remainingKm = run.route_points ? Math.round((((1 - (run.challenge_progress ?? 0)) * segCount) * SEG_M) / 100) / 10 : null;
    return {
      id: run.id,
      status: run.status,
      startedAt: run.started_at,
      endedAt: run.ended_at,
      distanceKm: Math.round(run.distance_m / 10) / 100,
      durationS: run.duration_s,
      paceS: run.distance_m > 0 ? Math.round(run.duration_s / (run.distance_m / 1000)) : null,
      gapCount: run.gap_count,
      gapSeconds: run.gap_seconds,
      challenge: run.challenge_id
        ? {
            id: run.challenge_id,
            title: run.challenge_title,
            shapeKey: run.shape_key,
            shapeLabel: shapeByKey(run.shape_key)?.label ?? run.category ?? '직접 그린 코스',
            status: run.challenge_status,
            isFriend: !run.ch_crew,
            progressBefore: run.progress_before,
            progressAfter: run.progress_after,
            currentProgress: run.challenge_progress,
            remainingKm,
            segmentLabel: run.segment_label,
            needsCategory: run.shape_key === 'custom' && run.challenge_status === 'completed' && !run.category && run.challenge_creator === userId,
          }
        : null,
    };
  }

  /** 기록 상세. 상세 GPS는 본인만 받는다. */
  async detail(userId: number, runId: number) {
    const s = await this.summary(userId, runId);
    const points = await this.db.many<{ lat: number; lng: number; recorded_at: string }>(
      `SELECT lat, lng, recorded_at FROM run_points WHERE run_id = $1 ORDER BY seq`,
      [runId],
    );
    const ch = s.challenge ? await this.db.one(`SELECT route_points FROM challenges WHERE id = $1`, [s.challenge.id]) : null;
    return { ...s, points: points.map((p) => [p.lat, p.lng]), route: ch?.route_points ?? null };
  }

  async month(userId: number, month: string) {
    if (!/^\d{4}-\d{2}$/.test(month ?? '')) throw new BadRequestException('month=YYYY-MM');
    const rows = await this.db.many(
      `SELECT r.id, r.started_at, r.duration_s, r.distance_m, r.segment_label, ch.title AS challenge_title, ch.id AS challenge_id
       FROM runs r LEFT JOIN challenges ch ON ch.id = r.challenge_id
       WHERE r.user_id = $1 AND r.status = 'saved' AND NOT r.challenge_deleted AND to_char(r.started_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM') = $2
       ORDER BY r.started_at`,
      [userId, month],
    );
    return rows.map((r) => ({
      id: r.id,
      startedAt: r.started_at,
      durationS: r.duration_s,
      distanceKm: Math.round(r.distance_m / 10) / 100,
      isChallenge: !!r.challenge_id,
      title: r.challenge_id ? `${r.challenge_title}${r.segment_label ? ' · ' + r.segment_label : ''}` : '개인 러닝',
    }));
  }

  /** 끝나지 않은 러닝(앱이 강제 종료됐을 때 복구용) */
  async unfinished(userId: number) {
    const run = await this.db.one(
      `SELECT r.id, r.client_id, r.started_at, r.challenge_id,
              (SELECT max(recorded_at) FROM run_points p WHERE p.run_id = r.id) AS last_at,
              (SELECT count(*)::int FROM run_points p WHERE p.run_id = r.id) AS points
       FROM runs r WHERE r.user_id = $1 AND r.status = 'recording' ORDER BY r.started_at DESC LIMIT 1`,
      [userId],
    );
    return run ?? null;
  }
}
