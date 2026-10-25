import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type pg from 'pg';
import { DbService, Queryable } from '../db/db.service.js';
import { photoUrlOf } from '../images/images.controller.js';
import { SETS as SHAPE_SETS, SHAPES } from '../geo/shapes.js';
import {
  COLOR_CLASH,
  colorDistance,
  hasBannedWord,
  levelOf,
  monthKey,
  pickFreeColor,
  randomCode,
} from '../common/util.js';

export const MAX_CREWS = 5;
const INVITE_DAYS = 7;

@Injectable()
export class CrewsService {
  constructor(private readonly db: DbService) {}

  private attempts = new Map<number, number[]>();

  /** 6자리 코드는 경우의 수가 적어서 사용자별로 시도 횟수를 제한한다(10분에 10번). */
  private rateLimit(userId: number) {
    const now = Date.now();
    const list = (this.attempts.get(userId) ?? []).filter((t) => now - t < 10 * 60_000);
    if (list.length >= 10) throw new HttpException('잠시 뒤에 다시 시도해 주세요.', HttpStatus.TOO_MANY_REQUESTS);
    list.push(now);
    this.attempts.set(userId, list);
  }

  async role(userId: number, crewId: number, db: Queryable = this.db.pool): Promise<'leader' | 'member' | null> {
    const r = await this.db.one<{ role: string }>(
      `SELECT role FROM crew_members WHERE crew_id = $1 AND user_id = $2 AND left_at IS NULL`,
      [crewId, userId],
      db,
    );
    return (r?.role as any) ?? null;
  }

  async assertMember(userId: number, crewId: number, db?: Queryable) {
    const r = await this.role(userId, crewId, db);
    if (!r) throw new ForbiddenException('이 크루의 크루원만 볼 수 있어요.');
    return r;
  }

  async assertLeader(userId: number, crewId: number, db?: Queryable) {
    const r = await this.role(userId, crewId, db);
    if (r !== 'leader') throw new ForbiddenException('크루장만 할 수 있어요.');
  }

  private async activeCount(userId: number, c: Queryable) {
    // 사용자 행을 잠가서 동시에 가입해도 5개를 넘지 않게 한다
    await c.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]);
    const r = await this.db.one<{ n: number }>(
      `SELECT count(*)::int AS n FROM crew_members m JOIN crews c ON c.id = m.crew_id
       WHERE m.user_id = $1 AND m.left_at IS NULL AND c.deleted_at IS NULL`,
      [userId],
      c,
    );
    return r!.n;
  }

  private async takenColors(crewId: number, c: Queryable) {
    return (
      await this.db.many<{ record_color: string }>(
        `SELECT record_color FROM crew_members WHERE crew_id = $1 AND left_at IS NULL`,
        [crewId],
        c,
      )
    ).map((r) => r.record_color);
  }

  private async addMember(crewId: number, userId: number, role: string, c: pg.PoolClient) {
    const color = pickFreeColor(await this.takenColors(crewId, c));
    await c.query(`INSERT INTO crew_members (crew_id, user_id, role, record_color) VALUES ($1, $2, $3, $4)`, [
      crewId,
      userId,
      role,
      color,
    ]);
    await c.query(
      `INSERT INTO user_crew_preferences (user_id, primary_crew_id) VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET primary_crew_id = COALESCE(user_crew_preferences.primary_crew_id, EXCLUDED.primary_crew_id)`,
      [userId, crewId],
    );
  }

  private async newInvite(crewId: number, userId: number, c: Queryable) {
    await c.query(`UPDATE crew_invites SET revoked_at = now() WHERE crew_id = $1 AND revoked_at IS NULL`, [crewId]);
    for (let i = 0; i < 20; i++) {
      const code = randomCode();
      const r = await c.query(
        `INSERT INTO crew_invites (crew_id, invite_code, created_by, expires_at)
         VALUES ($1, $2, $3, now() + interval '${INVITE_DAYS} days')
         ON CONFLICT DO NOTHING RETURNING invite_code, expires_at`,
        [crewId, code, userId],
      );
      if (r.rowCount) return r.rows[0] as { invite_code: string; expires_at: string };
    }
    throw new ConflictException('코드를 만들지 못했어요. 다시 시도해 주세요.');
  }

  private validateName(name: string) {
    const n = (name ?? '').trim();
    if (!n) throw new BadRequestException('크루 이름을 넣어 주세요.');
    if (n.length > 16) throw new BadRequestException('크루 이름은 16자까지예요.');
    if (hasBannedWord(n)) throw new BadRequestException('쓸 수 없는 단어가 들어 있어요.');
    return n;
  }

  async create(userId: number, b: { name: string; photoUrl?: string | null; color?: string; region?: string }) {
    const name = this.validateName(b.name);
    const photo = b.photoUrl === undefined ? null : photoUrlOf(b.photoUrl);
    return this.db.tx(async (c) => {
      if ((await this.activeCount(userId, c)) >= MAX_CREWS) {
        throw new ConflictException(`크루는 최대 ${MAX_CREWS}개까지 들어갈 수 있어요.`);
      }
      const crew = await this.db.one<{ id: number }>(
        `INSERT INTO crews (name, has_photo, photo_url, color, home_region, created_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [name, !!photo, photo, b.color ?? '#A3E635', b.region ?? '성동구 성수동', userId],
        c,
      );
      await this.addMember(crew!.id, userId, 'leader', c);
      const invite = await this.newInvite(crew!.id, userId, c);
      return { id: crew!.id, inviteCode: invite.invite_code };
    });
  }

  private async liveInvite(code: string, db: Queryable = this.db.pool) {
    return this.db.one<{ crew_id: number; name: string; join_policy: string; has_photo: boolean; photo_url: string | null; color: string }>(
      `SELECT i.crew_id, c.name, c.join_policy, c.has_photo, c.photo_url, c.color FROM crew_invites i JOIN crews c ON c.id = i.crew_id
       WHERE i.invite_code = $1 AND i.revoked_at IS NULL AND i.expires_at > now() AND c.deleted_at IS NULL`,
      [code],
      db,
    );
  }

  async previewCode(userId: number, code: string) {
    this.rateLimit(userId);
    const inv = await this.liveInvite(code);
    if (!inv) throw new NotFoundException('코드를 다시 확인해 주세요. 만료됐거나 새 코드로 바뀌었을 수 있어요.');
    const stats = await this.db.one<{ members: number; active: number }>(
      `SELECT (SELECT count(*)::int FROM crew_members WHERE crew_id = $1 AND left_at IS NULL) AS members,
              (SELECT count(*)::int FROM challenges WHERE crew_id = $1 AND status = 'active') AS active`,
      [inv.crew_id],
    );
    return { crewId: inv.crew_id, name: inv.name, hasPhoto: inv.has_photo, photoUrl: inv.photo_url, color: inv.color, ...stats, joinPolicy: inv.join_policy };
  }

  async joinByCode(userId: number, code: string) {
    this.rateLimit(userId);
    return this.db.tx(async (c) => {
      const inv = await this.liveInvite(code, c);
      if (!inv) throw new NotFoundException('코드를 다시 확인해 주세요.');
      if (await this.role(userId, inv.crew_id, c)) throw new ConflictException('이미 들어가 있는 크루예요.');
      if ((await this.activeCount(userId, c)) >= MAX_CREWS) {
        throw new ConflictException(`크루는 최대 ${MAX_CREWS}개까지 들어갈 수 있어요.`);
      }
      if (inv.join_policy === 'approve') {
        await c.query(
          `INSERT INTO crew_join_requests (crew_id, user_id) SELECT $1, $2
           WHERE NOT EXISTS (SELECT 1 FROM crew_join_requests WHERE crew_id = $1 AND user_id = $2 AND status = 'pending')`,
          [inv.crew_id, userId],
        );
        return { crewId: inv.crew_id, name: inv.name, status: 'requested' as const };
      }
      await this.addMember(inv.crew_id, userId, 'member', c);
      return { crewId: inv.crew_id, name: inv.name, status: 'joined' as const };
    });
  }

  async primaryCrewId(userId: number): Promise<number | null> {
    const r = await this.db.one<{ primary_crew_id: number | null }>(
      `SELECT p.primary_crew_id FROM user_crew_preferences p
       JOIN crew_members m ON m.crew_id = p.primary_crew_id AND m.user_id = p.user_id AND m.left_at IS NULL
       WHERE p.user_id = $1`,
      [userId],
    );
    return r?.primary_crew_id ?? null;
  }

  async myCrews(userId: number) {
    const primary = await this.primaryCrewId(userId);
    const rows = await this.db.many(
      `SELECT c.id, c.name, c.has_photo, c.photo_url, c.color, c.home_region, m.role, m.record_color,
              (SELECT count(*)::int FROM crew_members x WHERE x.crew_id = c.id AND x.left_at IS NULL) AS members,
              ch.id AS challenge_id, ch.title AS challenge_title, ch.progress, ch.end_at
       FROM crew_members m JOIN crews c ON c.id = m.crew_id
       LEFT JOIN LATERAL (
         SELECT id, title, progress, end_at FROM challenges x WHERE x.crew_id = c.id AND x.status = 'active' AND x.end_at > now()
         ORDER BY x.created_at DESC, x.id DESC LIMIT 1) ch ON true
       WHERE m.user_id = $1 AND m.left_at IS NULL AND c.deleted_at IS NULL
       ORDER BY m.joined_at`,
      [userId],
    );
    const invites = await this.db.many(
      `SELECT r.id, c.id AS crew_id, c.name FROM crew_join_requests r JOIN crews c ON c.id = r.crew_id
       WHERE r.user_id = $1 AND r.status = 'invited' AND c.deleted_at IS NULL`,
      [userId],
    );
    return {
      max: MAX_CREWS,
      primaryCrewId: primary ?? rows[0]?.id ?? null,
      crews: rows.map((r) => ({
        id: r.id,
        name: r.name,
        hasPhoto: r.has_photo,
        photoUrl: r.photo_url,
        color: r.color,
        region: r.home_region,
        role: r.role,
        myColor: r.record_color,
        members: r.members,
        activeChallenge: r.challenge_id
          ? { id: r.challenge_id, title: r.challenge_title, progress: r.progress, endAt: r.end_at }
          : null,
      })),
      invites: invites.map((i) => ({ id: i.id, crewId: i.crew_id, name: i.name })),
    };
  }

  async setPrimary(userId: number, crewId: number) {
    await this.assertMember(userId, crewId);
    await this.db.pool.query(
      `INSERT INTO user_crew_preferences (user_id, primary_crew_id, updated_at) VALUES ($1, $2, now())
       ON CONFLICT (user_id) DO UPDATE SET primary_crew_id = $2, updated_at = now()`,
      [userId, crewId],
    );
    return { primaryCrewId: crewId };
  }

  async level(crewId: number) {
    const r = await this.db.one<{ xp: number }>(
      `SELECT COALESCE(sum(xp_amount), 0)::int AS xp FROM crew_xp_transactions WHERE crew_id = $1`,
      [crewId],
    );
    return { totalXp: r!.xp, ...levelOf(r!.xp) };
  }

  async detail(userId: number, crewId: number) {
    const crew = await this.db.one(`SELECT * FROM crews WHERE id = $1 AND deleted_at IS NULL`, [crewId]);
    if (!crew) throw new NotFoundException('크루를 찾을 수 없어요.');
    const myRole = await this.role(userId, crewId);
    const level = await this.level(crewId);
    const month = monthKey();
    const members = await this.db.many(
      `SELECT u.id, u.display_name, m.role, m.record_color, m.joined_at,
              COALESCE((SELECT sum(r.distance_m) FROM runs r WHERE r.user_id = u.id AND r.crew_id = $1
                        AND to_char(r.started_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM') = $2 AND r.status = 'saved'), 0) AS month_m,
              (SELECT count(*)::int FROM runs r WHERE r.user_id = u.id AND r.crew_id = $1
                        AND to_char(r.started_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM') = $2 AND r.status = 'saved') AS month_runs
       FROM crew_members m JOIN users u ON u.id = m.user_id
       WHERE m.crew_id = $1 AND m.left_at IS NULL ORDER BY (m.role = 'leader') DESC, m.joined_at`,
      [crewId, month],
    );
    const base = {
      id: crew.id,
      name: crew.name,
      intro: crew.intro,
      hasPhoto: crew.has_photo,
      photoUrl: crew.photo_url,
      color: crew.color,
      region: crew.home_region,
      since: crew.created_at,
      level,
      memberCount: members.length,
    };
    const memberList = members.map((m) => ({
      id: m.id,
      name: m.display_name,
      role: m.role,
      color: m.record_color,
      isMe: m.id === userId,
      joinedAt: m.joined_at,
      monthKm: Math.round(Number(m.month_m) / 100) / 10,
      monthRuns: m.month_runs,
    }));
    if (!myRole) {
      // 다른 크루 상세: 공개 작품과 크루원 이름·이번 달 거리만
      const monthKm = memberList.reduce((s, m) => s + m.monthKm, 0);
      return {
        ...base,
        isMember: false,
        members: memberList.map(({ name, color, role, monthKm }) => ({ name, color, role, monthKm })),
        monthKm: Math.round(monthKm),
      };
    }
    const active = await this.db.one(
      `SELECT id, title, shape_key, custom_path, progress, end_at FROM challenges WHERE crew_id = $1 AND status = 'active' AND end_at > now()
       ORDER BY created_at DESC, id DESC LIMIT 1`,
      [crewId],
    );
    const pending = myRole === 'leader'
      ? await this.db.many(
          `SELECT r.id, r.user_id, u.display_name, r.created_at FROM crew_join_requests r JOIN users u ON u.id = r.user_id
           WHERE r.crew_id = $1 AND r.status = 'pending' ORDER BY r.created_at`,
          [crewId],
        )
      : [];
    const invite = await this.db.one(
      `SELECT invite_code, expires_at FROM crew_invites WHERE crew_id = $1 AND revoked_at IS NULL AND expires_at > now()`,
      [crewId],
    );
    const leader = memberList.find((m) => m.role === 'leader');
    return {
      ...base,
      isMember: true,
      myRole,
      leaderName: leader?.name ?? null,
      joinPolicy: crew.join_policy,
      challengePermission: crew.challenge_permission,
      artworkVisibility: crew.artwork_visibility,
      discoverable: crew.discoverable,
      myNotify: (await this.db.one(`SELECT notify FROM crew_members WHERE crew_id = $1 AND user_id = $2 AND left_at IS NULL`, [crewId, userId]))?.notify ?? true,
      activeChallenge: active
        ? { id: active.id, title: active.title, shapeKey: active.shape_key, customPath: active.custom_path ?? null, progress: active.progress, endAt: active.end_at }
        : null,
      members: memberList,
      joinRequests: pending.map((p) => ({ id: p.id, userId: p.user_id, name: p.display_name, createdAt: p.created_at })),
      invite: invite ? { code: invite.invite_code, expiresAt: invite.expires_at } : null,
    };
  }

  async update(userId: number, crewId: number, b: any) {
    await this.assertLeader(userId, crewId);
    const sets: string[] = [];
    const vals: unknown[] = [crewId];
    const put = (col: string, v: unknown) => {
      vals.push(v);
      sets.push(`${col} = $${vals.length}`);
    };
    if (b.name !== undefined) put('name', this.validateName(b.name));
    if (b.intro !== undefined) put('intro', String(b.intro).slice(0, 80));
    if (b.photoUrl !== undefined) {
      const photo = photoUrlOf(b.photoUrl);
      put('photo_url', photo);
      put('has_photo', !!photo);
    } else if (b.hasPhoto === false) {
      put('photo_url', null);
      put('has_photo', false);
    }
    if (b.color !== undefined) put('color', String(b.color));
    if (b.region !== undefined) put('home_region', String(b.region));
    if (b.discoverable !== undefined) put('discoverable', !!b.discoverable);
    if (b.joinPolicy !== undefined) put('join_policy', b.joinPolicy === 'approve' ? 'approve' : 'code');
    if (b.challengePermission !== undefined) put('challenge_permission', b.challengePermission === 'leader' ? 'leader' : 'all');
    if (b.artworkVisibility !== undefined) put('artwork_visibility', b.artworkVisibility === 'public' ? 'public' : 'crew');
    if (sets.length) await this.db.pool.query(`UPDATE crews SET ${sets.join(', ')}, updated_at = now() WHERE id = $1`, vals);
    return this.detail(userId, crewId);
  }

  async setMyNotify(userId: number, crewId: number, on: boolean) {
    await this.assertMember(userId, crewId);
    await this.db.pool.query(`UPDATE crew_members SET notify = $3 WHERE crew_id = $1 AND user_id = $2 AND left_at IS NULL`, [
      crewId,
      userId,
      !!on,
    ]);
    return { notify: !!on };
  }

  async setMyColor(userId: number, crewId: number, color: string) {
    if (!/^#[0-9A-F]{6}$/i.test(color ?? '')) throw new BadRequestException('0–9, A–F로 된 6자리 코드를 넣어 주세요.');
    await this.assertMember(userId, crewId);
    const others = await this.db.many<{ record_color: string; display_name: string }>(
      `SELECT m.record_color, u.display_name FROM crew_members m JOIN users u ON u.id = m.user_id
       WHERE m.crew_id = $1 AND m.left_at IS NULL AND m.user_id <> $2`,
      [crewId, userId],
    );
    const clash = others.find((o) => colorDistance(o.record_color, color) < COLOR_CLASH);
    if (clash) throw new ConflictException(`${clash.display_name}님 색과 너무 비슷해요. 조금 다른 곳을 골라 주세요.`);
    await this.db.pool.query(`UPDATE crew_members SET record_color = $3 WHERE crew_id = $1 AND user_id = $2 AND left_at IS NULL`, [
      crewId,
      userId,
      color.toUpperCase(),
    ]);
    return { color: color.toUpperCase() };
  }

  async renewInvite(userId: number, crewId: number) {
    await this.assertMember(userId, crewId);
    const inv = await this.db.tx((c) => this.newInvite(crewId, userId, c));
    return { code: inv.invite_code, expiresAt: inv.expires_at };
  }

  async decideRequest(userId: number, crewId: number, requestId: number, accept: boolean) {
    await this.assertLeader(userId, crewId);
    return this.db.tx(async (c) => {
      const req = await this.db.one<{ user_id: number }>(
        `SELECT user_id FROM crew_join_requests WHERE id = $1 AND crew_id = $2 AND status = 'pending' FOR UPDATE`,
        [requestId, crewId],
        c,
      );
      if (!req) throw new NotFoundException('이미 처리된 요청이에요.');
      if (accept) {
        if ((await this.activeCount(req.user_id, c)) >= MAX_CREWS) throw new ConflictException('상대가 이미 크루 5개에 들어가 있어요.');
        await this.addMember(crewId, req.user_id, 'member', c);
      }
      await c.query(`UPDATE crew_join_requests SET status = $2 WHERE id = $1`, [requestId, accept ? 'accepted' : 'declined']);
      return { ok: true };
    });
  }

  /** 친구 챌린지에서 만든 크루의 초대를 수락 */
  async acceptInvite(userId: number, requestId: number) {
    return this.db.tx(async (c) => {
      const req = await this.db.one<{ crew_id: number }>(
        `SELECT crew_id FROM crew_join_requests WHERE id = $1 AND user_id = $2 AND status = 'invited' FOR UPDATE`,
        [requestId, userId],
        c,
      );
      if (!req) throw new NotFoundException('초대를 찾을 수 없어요.');
      if ((await this.activeCount(userId, c)) >= MAX_CREWS) throw new ConflictException(`크루는 최대 ${MAX_CREWS}개까지예요.`);
      await this.addMember(req.crew_id, userId, 'member', c);
      await c.query(`UPDATE crew_join_requests SET status = 'accepted' WHERE id = $1`, [requestId]);
      return { crewId: req.crew_id };
    });
  }

  async transferLeader(userId: number, crewId: number, toUserId: number) {
    await this.assertLeader(userId, crewId);
    return this.db.tx(async (c) => {
      const target = await this.role(toUserId, crewId, c);
      if (!target) throw new NotFoundException('크루원을 찾을 수 없어요.');
      await c.query(`UPDATE crew_members SET role = 'member' WHERE crew_id = $1 AND user_id = $2 AND left_at IS NULL`, [crewId, userId]);
      await c.query(`UPDATE crew_members SET role = 'leader' WHERE crew_id = $1 AND user_id = $2 AND left_at IS NULL`, [crewId, toUserId]);
      return { ok: true };
    });
  }

  async removeMember(userId: number, crewId: number, targetId: number) {
    await this.assertLeader(userId, crewId);
    if (targetId === userId) throw new BadRequestException('나 자신은 내보낼 수 없어요.');
    await this.db.tx(async (c) => {
      await c.query(`UPDATE crew_members SET left_at = now() WHERE crew_id = $1 AND user_id = $2 AND left_at IS NULL`, [crewId, targetId]);
      await this.fixPrimaryAfterLeave(targetId, crewId, c);
    });
    return { ok: true };
  }

  /** 대표 크루를 나가면 가장 최근에 달린 크루가 대표가 된다 */
  private async fixPrimaryAfterLeave(userId: number, leftCrewId: number, c: Queryable) {
    const pref = await this.db.one<{ primary_crew_id: number | null }>(
      `SELECT primary_crew_id FROM user_crew_preferences WHERE user_id = $1`,
      [userId],
      c,
    );
    if (pref?.primary_crew_id !== leftCrewId) return null;
    const next = await this.db.one<{ id: number; name: string }>(
      `SELECT c.id, c.name FROM crew_members m JOIN crews c ON c.id = m.crew_id
       WHERE m.user_id = $1 AND m.left_at IS NULL AND c.deleted_at IS NULL
       ORDER BY (SELECT max(r.started_at) FROM runs r WHERE r.user_id = $1 AND r.crew_id = c.id) DESC NULLS LAST, m.joined_at DESC
       LIMIT 1`,
      [userId],
      c,
    );
    await c.query(`UPDATE user_crew_preferences SET primary_crew_id = $2, updated_at = now() WHERE user_id = $1`, [
      userId,
      next?.id ?? null,
    ]);
    return next ?? null;
  }

  async leave(userId: number, crewId: number) {
    return this.db.tx(async (c) => {
      const role = await this.role(userId, crewId, c);
      if (!role) throw new NotFoundException('들어가 있지 않은 크루예요.');
      if (role === 'leader') {
        throw new ConflictException('크루장은 다른 크루원에게 크루장을 넘긴 뒤 나갈 수 있어요.');
      }
      await c.query(`UPDATE crew_members SET left_at = now() WHERE crew_id = $1 AND user_id = $2 AND left_at IS NULL`, [crewId, userId]);
      const newPrimary = await this.fixPrimaryAfterLeave(userId, crewId, c);
      return { ok: true, newPrimary };
    });
  }

  async remove(userId: number, crewId: number, confirmName: string) {
    await this.assertLeader(userId, crewId);
    const crew = await this.db.one<{ name: string }>(`SELECT name FROM crews WHERE id = $1`, [crewId]);
    if ((confirmName ?? '').trim() !== crew?.name) throw new BadRequestException('크루 이름이 맞지 않아요.');
    return this.db.tx(async (c) => {
      const members = await this.db.many<{ user_id: number }>(
        `SELECT user_id FROM crew_members WHERE crew_id = $1 AND left_at IS NULL`,
        [crewId],
        c,
      );
      await c.query(`UPDATE challenges SET status = 'cancelled', cancelled_at = now() WHERE crew_id = $1 AND status = 'active'`, [crewId]);
      await c.query(`UPDATE crew_members SET left_at = now() WHERE crew_id = $1 AND left_at IS NULL`, [crewId]);
      await c.query(`UPDATE crew_invites SET revoked_at = now() WHERE crew_id = $1 AND revoked_at IS NULL`, [crewId]);
      await c.query(`UPDATE crews SET deleted_at = now() WHERE id = $1`, [crewId]);
      for (const m of members) await this.fixPrimaryAfterLeave(m.user_id, crewId, c);
      return { ok: true };
    });
  }

  /** 이름으로 찾은 사람을 초대(on=false면 초대 취소). 받은 사람은 내 크루 화면에서 수락한다 */
  async inviteUser(userId: number, crewId: number, targetId: number, on: boolean) {
    await this.assertMember(userId, crewId);
    if (targetId === userId) throw new BadRequestException('나 자신은 초대할 수 없어요.');
    if (await this.role(targetId, crewId)) throw new ConflictException('이미 크루원이에요.');
    if (on) {
      await this.db.pool.query(
        `INSERT INTO crew_join_requests (crew_id, user_id, status) VALUES ($1, $2, 'invited') ON CONFLICT DO NOTHING`,
        [crewId, targetId],
      );
    } else {
      await this.db.pool.query(`DELETE FROM crew_join_requests WHERE crew_id = $1 AND user_id = $2 AND status = 'invited'`, [crewId, targetId]);
    }
    return { invited: on };
  }

  async report(userId: number, crewId: number, b: { reason: string; detail?: string }) {
    if (!['photo', 'name', 'art', 'etc'].includes(b.reason)) throw new BadRequestException('신고 이유를 골라 주세요.');
    const crew = await this.db.one<{ name: string; intro: string }>(`SELECT name, intro FROM crews WHERE id = $1 AND deleted_at IS NULL`, [crewId]);
    if (!crew) throw new NotFoundException('크루를 찾을 수 없어요.');
    if (await this.role(userId, crewId)) throw new BadRequestException('내 크루는 신고할 수 없어요.');
    // 이름·소개 신고는 금칙어로 먼저 걸러 표시해 두고, 사진은 사람이 본다
    const autoFlagged = b.reason === 'name' && hasBannedWord(`${crew.name} ${crew.intro}`);
    await this.db.pool.query(
      `INSERT INTO crew_reports (crew_id, reporter_id, reason, detail, auto_flagged) VALUES ($1, $2, $3, $4, $5)`,
      [crewId, userId, b.reason, String(b.detail ?? '').slice(0, 500), autoFlagged],
    );
    return { ok: true, review: b.reason === 'photo' ? 'manual' : 'auto' };
  }

  /** 그림 도감: 크루 단위. 달성률 80% 이상이면 '모음', 미완료는 '반쯤', 한정 세트는 열리기 전 잠금 */
  async collection(userId: number, crewId: number) {
    await this.assertMember(userId, crewId);
    const rows = await this.db.many<{ shape_key: string; category: string | null; best: number; path: string | null }>(
      `SELECT shape_key, category, max(progress) AS best,
              (array_agg(custom_path ORDER BY progress DESC) FILTER (WHERE custom_path IS NOT NULL))[1] AS path FROM challenges
       WHERE crew_id = $1 AND status IN ('completed', 'cancelled', 'expired') GROUP BY shape_key, category`,
      [crewId],
    );
    const best = new Map<string, number>();
    const pathOf = new Map<string, string>();
    for (const r of rows) {
      if (r.shape_key === 'custom' && r.path && !pathOf.has(r.category ?? 'custom')) pathOf.set(r.category ?? 'custom', r.path);
      const key = r.shape_key === 'custom' ? (r.category ?? 'custom') : r.shape_key;
      best.set(key, Math.max(best.get(key) ?? 0, r.best));
    }
    const LABEL: Record<string, string> = Object.fromEntries(SHAPES.map((x) => [x.key, x.label]));
    // 직접 그린 그림 이름은 같은 이름의 라이브러리 그림으로 모은다
    for (const [k, v] of [...best]) {
      const hit = Object.entries(LABEL).find(([, l]) => l === k);
      if (hit) best.set(hit[0], Math.max(best.get(hit[0]) ?? 0, v));
    }
    // 직접 그린 코스 중 라이브러리에 없는 이름은 '나만의 그림'으로 따로 모은다(라이브러리 key는 빼고)
    const labels = new Set(Object.values(LABEL));
    const own = [...best].filter(([k]) => !LABEL[k] && !labels.has(k) && k !== 'custom').map(([k, v]) => ({ key: k, best: v }));
    const now = new Date();
    const sets = SHAPE_SETS.map((s) => {
      const locked = s.opensAt ? new Date(s.opensAt) > now : false;
      const items = SHAPES.filter((x) => x.category === s.name).map((x) => {
        const b = best.get(x.key);
        const state = locked ? 'locked' : b == null ? 'none' : b >= 0.8 ? 'got' : 'half';
        return { key: x.key, label: locked ? '?' : x.label, state, km: x.km, progress: b ?? 0 };
      });
      return { name: s.name, reward: s.reward, got: items.filter((i) => i.state === 'got').length, total: items.length, items };
    });
    // 나만의 그림은 모은 만큼만 보여 주고 전체 개수에는 넣지 않는다
    if (own.length)
      sets.push({
        name: '나만의 그림',
        reward: '직접 그려 완성한 그림',
        got: own.filter((o) => o.best >= 0.8).length,
        total: own.length,
        items: own.map((o) => ({ key: 'custom', label: o.key, state: o.best >= 0.8 ? 'got' : 'half', km: 0, progress: o.best, path: pathOf.get(o.key) ?? null })),
      });
    const counted = sets.filter((x) => x.name !== '나만의 그림');
    return {
      got: counted.reduce((s, x) => s + x.got, 0),
      total: counted.reduce((s, x) => s + x.total, 0),
      sets,
    };
  }
}
