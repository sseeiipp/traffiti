import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DbService } from '../db/db.service.js';
import { hasBannedWord } from '../common/util.js';
import { photoUrlOf } from '../images/images.controller.js';

const SETTING_COLS: Record<string, string> = {
  region: 'region',
  regionAuto: 'region_auto',
  distanceUnit: 'distance_unit',
  notifyNewChallenge: 'notify_new_challenge',
  notifySegment: 'notify_segment',
  notifyArtwork: 'notify_artwork',
  gpsVisibility: 'gps_visibility',
  artworkVisibility: 'artwork_visibility',
  hideStartOnShare: 'hide_start_on_share',
};

@Injectable()
export class UsersService {
  constructor(private readonly db: DbService) {}

  async me(userId: number) {
    const u = await this.db.one(
      `SELECT u.id, u.display_name, u.email, u.auth_provider, u.profile_image_url, u.email_verified_at, s.*
       FROM users u LEFT JOIN user_settings s ON s.user_id = u.id WHERE u.id = $1 AND u.deleted_at IS NULL`,
      [userId],
    );
    if (!u) throw new NotFoundException('계정을 찾을 수 없어요.');
    const leaderOf = await this.db.many<{ id: number; name: string; others: number }>(
      `SELECT c.id, c.name, (SELECT count(*)::int FROM crew_members x WHERE x.crew_id = c.id AND x.left_at IS NULL AND x.user_id <> $1) AS others
       FROM crew_members m JOIN crews c ON c.id = m.crew_id
       WHERE m.user_id = $1 AND m.role = 'leader' AND m.left_at IS NULL AND c.deleted_at IS NULL`,
      [userId],
    );
    return {
      id: u.id,
      name: u.display_name,
      email: u.email,
      provider: u.auth_provider,
      emailVerified: !!u.email_verified_at,
      hasPhoto: !!u.profile_image_url,
      photoUrl: (u.profile_image_url as string | null) ?? null,
      settings: {
        region: u.region ?? '성동구 성수동',
        regionAuto: u.region_auto ?? true,
        distanceUnit: u.distance_unit ?? 'km',
        notifyNewChallenge: u.notify_new_challenge ?? true,
        notifySegment: u.notify_segment ?? false,
        notifyArtwork: u.notify_artwork ?? true,
        gpsVisibility: u.gps_visibility ?? 'me',
        artworkVisibility: u.artwork_visibility ?? 'crew',
        hideStartOnShare: u.hide_start_on_share ?? true,
      },
      leaderOf: leaderOf.map((l) => ({ id: l.id, name: l.name, hasOthers: l.others > 0 })),
    };
  }

  async update(userId: number, b: { name?: string; hasPhoto?: boolean; photoUrl?: string | null }) {
    if (b.name !== undefined) {
      const name = String(b.name).trim();
      if (!name || name.length > 10) throw new BadRequestException('이름은 1–10자예요.');
      await this.db.pool.query(`UPDATE users SET display_name = $2, updated_at = now() WHERE id = $1`, [userId, name]);
    }
    if (b.photoUrl !== undefined) {
      await this.db.pool.query(`UPDATE users SET profile_image_url = $2 WHERE id = $1`, [userId, photoUrlOf(b.photoUrl)]);
    } else if (b.hasPhoto === false) {
      await this.db.pool.query(`UPDATE users SET profile_image_url = NULL WHERE id = $1`, [userId]);
    }
    return this.me(userId);
  }

  async updateSettings(userId: number, b: Record<string, unknown>) {
    const sets: string[] = [];
    const vals: unknown[] = [userId];
    for (const [k, col] of Object.entries(SETTING_COLS)) {
      if (b[k] === undefined) continue;
      vals.push(b[k]);
      sets.push(`${col} = $${vals.length}`);
    }
    if (sets.length) {
      await this.db.pool.query(`INSERT INTO user_settings (user_id) VALUES ($1) ON CONFLICT DO NOTHING`, [userId]);
      await this.db.pool.query(`UPDATE user_settings SET ${sets.join(', ')} WHERE user_id = $1`, vals);
    }
    return this.me(userId);
  }

  /**
   * 유저 찾기(32). 검색어가 없으면 같은 챌린지에서 함께 달린 적 있는 사람을 보여준다.
   * crewId를 주면 그 크루에 이미 초대했는지·크루원인지 함께 알려준다.
   */
  async search(userId: number, q: string, crewId?: number) {
    const term = (q ?? '').trim().slice(0, 20);
    const rows = term
      ? await this.db.many(
          `SELECT u.id, u.display_name AS name FROM users u
           WHERE u.deleted_at IS NULL AND u.id <> $1 AND u.display_name ILIKE '%' || $2 || '%'
           ORDER BY (u.display_name = $2) DESC, u.display_name LIMIT 30`,
          [userId, term],
        )
      : await this.db.many(
          `SELECT u.id, u.display_name AS name FROM users u
           WHERE u.deleted_at IS NULL AND u.id <> $1 AND u.id IN (
             SELECT b.user_id FROM challenge_coverage a JOIN challenge_coverage b ON b.challenge_id = a.challenge_id
             WHERE a.user_id = $1 AND b.user_id IS NOT NULL)
           ORDER BY u.display_name LIMIT 30`,
          [userId],
        );
    const ids = rows.map((r) => r.id);
    const meta = ids.length
      ? await this.db.many<{ id: number; crew_name: string | null; color: string | null; invited: boolean; member: boolean }>(
          `SELECT u.id,
                  (SELECT c.name FROM user_crew_preferences p JOIN crews c ON c.id = p.primary_crew_id AND c.deleted_at IS NULL WHERE p.user_id = u.id) AS crew_name,
                  (SELECT m.record_color FROM user_crew_preferences p JOIN crew_members m ON m.crew_id = p.primary_crew_id AND m.user_id = u.id AND m.left_at IS NULL WHERE p.user_id = u.id) AS color,
                  EXISTS (SELECT 1 FROM crew_join_requests r WHERE r.crew_id = $2 AND r.user_id = u.id AND r.status = 'invited') AS invited,
                  EXISTS (SELECT 1 FROM crew_members m WHERE m.crew_id = $2 AND m.user_id = u.id AND m.left_at IS NULL) AS member
           FROM users u WHERE u.id = ANY($1)`,
          [ids, crewId ?? 0],
        )
      : [];
    return rows.map((r) => {
      const m = meta.find((x) => x.id === r.id);
      return { id: r.id, name: r.name, crew: m?.crew_name ?? '크루 없음', color: m?.color ?? '#6E6E73', invited: !!m?.invited, member: !!m?.member };
    });
  }

  /** 유저 프로필(33): 대표 크루 · 이번 달 거리 · 완성 작품. 상세 경로는 보여주지 않는다 */
  async profile(viewerId: number, userId: number) {
    const u = await this.db.one<{ id: number; name: string }>(
      `SELECT id, display_name AS name FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [userId],
    );
    if (!u) throw new NotFoundException('유저를 찾을 수 없어요.');
    const crew = await this.db.one<{ id: number; name: string; color: string }>(
      `SELECT c.id, c.name, m.record_color AS color FROM user_crew_preferences p
       JOIN crews c ON c.id = p.primary_crew_id AND c.deleted_at IS NULL
       JOIN crew_members m ON m.crew_id = c.id AND m.user_id = p.user_id AND m.left_at IS NULL
       WHERE p.user_id = $1`,
      [userId],
    );
    const stats = await this.db.one<{ month_m: number; done: number }>(
      `SELECT COALESCE((SELECT sum(distance_m) FROM runs WHERE user_id = $1 AND status = 'saved'
                        AND to_char(started_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM') = to_char(now() AT TIME ZONE 'Asia/Seoul', 'YYYY-MM')), 0) AS month_m,
              (SELECT count(DISTINCT ch.id)::int FROM challenges ch JOIN challenge_coverage cv ON cv.challenge_id = ch.id
               WHERE cv.user_id = $1 AND ch.status = 'completed') AS done`,
      [userId],
    );
    const xp = crew
      ? await this.db.one<{ xp: number }>(`SELECT COALESCE(sum(xp_amount), 0)::int AS xp FROM crew_xp_transactions WHERE crew_id = $1`, [crew.id])
      : null;
    // 함께 만든 작품: 보는 사람과 이 유저가 둘 다 구간을 채운 완성 작품
    const together = await this.db.many<{ id: number; shape_key: string; category: string | null; color: string }>(
      `SELECT ch.id, ch.shape_key, ch.category, min(b.color) AS color FROM challenges ch
       JOIN challenge_coverage a ON a.challenge_id = ch.id AND a.user_id = $1
       JOIN challenge_coverage b ON b.challenge_id = ch.id AND b.user_id = $2
       WHERE ch.status IN ('completed', 'cancelled', 'expired') GROUP BY ch.id ORDER BY ch.id DESC LIMIT 6`,
      [viewerId, userId],
    );
    return {
      id: u.id,
      name: u.name,
      isMe: u.id === viewerId,
      color: crew?.color ?? '#6E6E73',
      primaryCrew: crew ? { id: crew.id, name: crew.name } : null,
      monthKm: Math.round(Number(stats!.month_m) / 1000),
      completedArtworks: stats!.done,
      crewLevel: xp ? Math.floor(xp.xp / 1000) + 1 : null,
      together: together.map((t) => ({ id: t.id, shapeKey: t.shape_key, name: t.category, color: t.color })),
    };
  }

  async report(reporterId: number, userId: number, b: { reason: string; detail?: string }) {
    if (!['name', 'abuse', 'spam', 'cheat', 'etc'].includes(b.reason)) throw new BadRequestException('신고 이유를 골라 주세요.');
    if (reporterId === userId) throw new BadRequestException('나 자신은 신고할 수 없어요.');
    const u = await this.db.one<{ name: string }>(`SELECT display_name AS name FROM users WHERE id = $1 AND deleted_at IS NULL`, [userId]);
    if (!u) throw new NotFoundException('유저를 찾을 수 없어요.');
    const autoFlagged = b.reason === 'name' && hasBannedWord(u.name);
    await this.db.pool.query(`INSERT INTO user_reports (user_id, reporter_id, reason, detail, auto_flagged) VALUES ($1, $2, $3, $4, $5)`, [
      userId,
      reporterId,
      b.reason,
      String(b.detail ?? '').slice(0, 500),
      autoFlagged,
    ]);
    return { ok: true, review: b.reason === 'name' ? 'manual' : 'auto' };
  }

  /**
   * 계정 삭제. 러닝 기록과 GPS는 지우고, 작품의 기여 구간은 남기되 이름은 '나간 크루원'으로 보인다.
   * 다른 크루원이 있는 크루의 크루장이면 먼저 넘겨야 한다.
   */
  async remove(userId: number) {
    const me = await this.me(userId);
    const blocked = me.leaderOf.filter((l) => l.hasOthers);
    if (blocked.length) {
      throw new ConflictException(`${blocked.map((b) => b.name).join(', ')} 크루장을 다른 크루원에게 넘겨 주세요.`);
    }
    await this.db.tx(async (c) => {
      // 혼자 남은 크루는 함께 정리
      for (const l of me.leaderOf) {
        await c.query(`UPDATE challenges SET status = 'cancelled', cancelled_at = now() WHERE crew_id = $1 AND status = 'active'`, [l.id]);
        await c.query(`UPDATE crews SET deleted_at = now() WHERE id = $1`, [l.id]);
      }
      // 기여 구간에서 run_id 연결을 끊고 러닝·GPS 원본을 지운다
      await c.query(`UPDATE challenge_coverage SET run_id = NULL WHERE user_id = $1`, [userId]);
      await c.query(`DELETE FROM runs WHERE user_id = $1`, [userId]);
      await c.query(`UPDATE crew_members SET left_at = now() WHERE user_id = $1 AND left_at IS NULL`, [userId]);
      await c.query(`DELETE FROM user_auth_accounts WHERE user_id = $1`, [userId]);
      await c.query(`DELETE FROM user_settings WHERE user_id = $1`, [userId]);
      await c.query(`DELETE FROM user_crew_preferences WHERE user_id = $1`, [userId]);
      await c.query(
        `UPDATE users SET deleted_at = now(), email = NULL, display_name = '나간 크루원', profile_image_url = NULL WHERE id = $1`,
        [userId],
      );
    });
    return { ok: true };
  }
}
