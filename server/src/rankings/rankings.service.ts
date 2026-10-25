import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DbService } from '../db/db.service.js';
import { competitionRank, KST, levelOf, monthKey, prevMonthKey, tierOf } from '../common/util.js';
import { shapeByKey } from '../geo/shapes.js';

type RankType = 'completion_rate' | 'xp';

interface Scored {
  crewId: number;
  score: number;
  detail: string;
}

@Injectable()
export class RankingsService {
  private readonly log = new Logger(RankingsService.name);

  constructor(private readonly db: DbService) {}

  private monthRange(key: string) {
    const [y, m] = key.split('-').map(Number);
    // 한국 시간 기준 월 경계
    const start = new Date(Date.UTC(y, m - 1, 1) - 9 * 3600_000);
    const end = new Date(Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 1) - 9 * 3600_000);
    return { start, end };
  }

  private async score(type: RankType, periodKey: string, category: string): Promise<Scored[]> {
    const monthly = periodKey !== 'all';
    const range = monthly ? this.monthRange(periodKey) : null;
    if (type === 'xp') {
      const rows = await this.db.many<{ crew_id: number; xp: number }>(
        `SELECT c.id AS crew_id, COALESCE(sum(t.xp_amount) FILTER (WHERE $1::timestamptz IS NULL OR (t.created_at >= $1 AND t.created_at < $2)), 0)::int AS xp
         FROM crews c LEFT JOIN crew_xp_transactions t ON t.crew_id = c.id
         WHERE c.deleted_at IS NULL GROUP BY c.id`,
        [range?.start ?? null, range?.end ?? null],
      );
      return rows.filter((r) => r.xp > 0).map((r) => ({ crewId: r.crew_id, score: r.xp, detail: '' }));
    }
    const rows = await this.db.many<{ crew_id: number; shape_key: string; category: string | null; progress: number; status: string }>(
      `SELECT ch.crew_id, ch.shape_key, ch.category, ch.progress, ch.status FROM challenges ch JOIN crews c ON c.id = ch.crew_id
       WHERE c.deleted_at IS NULL AND ch.crew_id IS NOT NULL
         AND ($1::timestamptz IS NULL OR (ch.start_at < $2 AND COALESCE(ch.completed_at, ch.cancelled_at, ch.end_at) >= $1))`,
      [range?.start ?? null, range?.end ?? null],
    );
    const filtered = rows.filter(
      (r) => category === 'all' || r.shape_key === category || r.category === category || shapeByKey(category)?.label === r.category,
    );
    const by = new Map<number, typeof filtered>();
    for (const r of filtered) by.set(r.crew_id, [...(by.get(r.crew_id) ?? []), r]);
    const label = (r: (typeof filtered)[number]) => r.category ?? shapeByKey(r.shape_key)?.label ?? '직접 그린 코스';
    return [...by.entries()].map(([crewId, list]) => {
      if (monthly) {
        const best = list.reduce((a, b) => (b.progress > a.progress ? b : a));
        const state = best.status === 'completed' ? '완성' : best.status === 'active' ? '진행 중' : '미완료';
        return { crewId, score: Math.round(best.progress * 100), detail: `${label(best)} ${state}` };
      }
      const avg = list.reduce((s, r) => s + r.progress, 0) / list.length;
      const done = list.filter((r) => r.status === 'completed').length;
      return { crewId, score: Math.round(avg * 100), detail: `완성 작품 ${done}` };
    });
  }

  /** 계산해서 스냅샷으로 저장 */
  async snapshot(type: RankType, periodKey: string, category = 'all') {
    const ranked = competitionRank(await this.score(type, periodKey, category));
    const at = new Date();
    await this.db.tx(async (c) => {
      for (const r of ranked) {
        await c.query(
          `INSERT INTO crew_ranking_snapshots (crew_id, ranking_type, period_key, category, score, rank, tier, detail, calculated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [r.crewId, type, periodKey, category, r.score, r.rank, type === 'completion_rate' ? tierOf(r.score) : null, r.detail, at],
        );
      }
    });
    return at;
  }

  private async latest(type: RankType, periodKey: string, category: string) {
    const head = await this.db.one<{ at: string }>(
      `SELECT max(calculated_at) AS at FROM crew_ranking_snapshots WHERE ranking_type = $1 AND period_key = $2 AND category = $3`,
      [type, periodKey, category],
    );
    if (!head?.at) return null;
    const rows = await this.db.many(
      `SELECT * FROM crew_ranking_snapshots WHERE ranking_type = $1 AND period_key = $2 AND category = $3 AND calculated_at = $4`,
      [type, periodKey, category, head.at],
    );
    return { at: head.at, rows };
  }

  async get(userId: number, q: { type?: string; period?: string; month?: string; category?: string; search?: string }) {
    const type: RankType = q.type === 'xp' ? 'xp' : 'completion_rate';
    const monthly = q.period !== 'all_time';
    const periodKey = monthly ? (q.month && /^\d{4}-\d{2}$/.test(q.month) ? q.month : monthKey()) : 'all';
    const category = type === 'xp' ? 'all' : (q.category ?? 'all');
    if (category.length > 20) throw new BadRequestException('카테고리를 확인해 주세요.');

    let snap = await this.latest(type, periodKey, category);
    if (!snap) {
      await this.snapshot(type, periodKey, category);
      snap = await this.latest(type, periodKey, category);
    }
    const prev = monthly && category === 'all' ? await this.latest(type, prevMonthKey(periodKey), 'all') : null;
    const crews = await this.db.many(
      `SELECT c.id, c.name, c.color, c.has_photo,
              (SELECT count(*)::int FROM crew_members m WHERE m.crew_id = c.id AND m.left_at IS NULL) AS members,
              (SELECT COALESCE(sum(xp_amount), 0)::int FROM crew_xp_transactions t WHERE t.crew_id = c.id) AS xp,
              EXISTS (SELECT 1 FROM crew_members m WHERE m.crew_id = c.id AND m.user_id = $1 AND m.left_at IS NULL) AS mine
       FROM crews c WHERE c.id = ANY($2)`,
      [userId, snap!.rows.map((r) => r.crew_id)],
    );
    const search = (q.search ?? '').trim().slice(0, 20);
    const all = snap!.rows
      .map((r) => {
        const c = crews.find((x) => x.id === r.crew_id);
        if (!c) return null;
        const p = prev?.rows.find((x) => x.crew_id === r.crew_id);
        const tie = snap!.rows.filter((o) => o.score === r.score).length > 1;
        return {
          crewId: c.id,
          name: c.name,
          color: c.color,
          hasPhoto: c.has_photo,
          members: c.members,
          level: levelOf(c.xp).level,
          mine: c.mine,
          score: r.score,
          rank: r.rank,
          tie,
          tier: r.tier,
          detail: r.detail,
          // 순위 변동은 지난달 기록이 있을 때만
          change: !monthly || category !== 'all' ? undefined : !prev ? undefined : p ? p.rank - r.rank : 'NEW',
        };
      })
      .filter((x): x is NonNullable<typeof x> => !!x)
      .sort((a, b) => a.rank - b.rank);
    return {
      type,
      periodKey,
      category,
      updatedAt: snap!.at,
      rows: search ? all.filter((r) => r.name.includes(search)) : all,
      total: all.length,
    };
  }

  async categories() {
    const rows = await this.db.many<{ key: string }>(
      `SELECT DISTINCT COALESCE(category, shape_key) AS key FROM challenges WHERE crew_id IS NOT NULL AND shape_key <> 'custom' OR category IS NOT NULL`,
    );
    return [{ key: 'all', label: '모든 그림' }, ...rows.map((r) => ({ key: r.key, label: shapeByKey(r.key)?.label ?? r.key }))];
  }

  /** 하루 한 번, 새벽 4시(한국 시간) */
  @Cron('0 0 4 * * *', { timeZone: KST })
  async daily() {
    const m = monthKey();
    const cats = (await this.categories()).map((c) => c.key);
    for (const cat of cats) await this.snapshot('completion_rate', m, cat);
    await this.snapshot('completion_rate', 'all', 'all');
    await this.snapshot('xp', m, 'all');
    await this.snapshot('xp', 'all', 'all');
    this.log.log(`ranking snapshots updated for ${m}`);
  }

  /** 개발용: 바로 다시 집계 */
  async recomputeNow() {
    await this.daily();
    return { ok: true };
  }
}
