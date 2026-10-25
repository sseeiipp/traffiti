import { Controller, Get, Param, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../auth/auth.guard.js';
import { appPage, esc } from '../common/page.js';
import { DbService } from '../db/db.service.js';
import { shapeByKey } from '../geo/shapes.js';
import type { LatLng } from '../geo/geometry.js';

/** 경로를 정사각형 SVG에 맞춰 그린다(위도는 위가 북쪽이 되게 뒤집는다) */
function routeSvg(route: LatLng[], segs: (string | null)[]) {
  if (route.length < 2) return '';
  const k = Math.cos((route[0][0] * Math.PI) / 180);
  const xs = route.map((p) => p[1] * k);
  const ys = route.map((p) => -p[0]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const span = Math.max(maxX - minX, maxY - minY) || 1;
  const pt = (i: number) =>
    `${(((xs[i] - minX) / span) * 100 + (100 - ((maxX - minX) / span) * 100) / 2).toFixed(2)},${(((ys[i] - minY) / span) * 100 + (100 - ((maxY - minY) / span) * 100) / 2).toFixed(2)}`;
  const base = route.map((_, i) => pt(i)).join(' ');
  const lines = segs
    .map((c, i) => (c ? `<line x1="${pt(i).split(',')[0]}" y1="${pt(i).split(',')[1]}" x2="${pt(i + 1).split(',')[0]}" y2="${pt(i + 1).split(',')[1]}" stroke="${esc(c)}" stroke-width="3" stroke-linecap="round"/>` : ''))
    .join('');
  return `<div class="art"><svg viewBox="-4 -4 108 108"><polyline points="${base}" fill="none" stroke="#3f3f46" stroke-width="2" stroke-dasharray="1.5 2.5" stroke-linecap="round"/>${lines}</svg></div>`;
}

/**
 * 앱 밖으로 나가는 공유 링크(작품, 친구 챌린지 초대, 크루 초대).
 * 앱이 있으면 버튼으로 앱의 같은 화면을 열고, 없으면 웹에서 내용을 보여 준다.
 */
@ApiExcludeController()
@Public()
@Controller()
export class ShareController {
  constructor(private readonly db: DbService) {}

  @Get('a/:id')
  async artwork(@Param('id') idRaw: string, @Res() res: Response) {
    const id = Number(idRaw);
    const ch = Number.isInteger(id)
      ? await this.db.one<{ title: string; status: string; route_points: LatLng[]; crew_name: string | null; public: boolean; progress: number }>(
          `SELECT ch.title, ch.status, ch.route_points, ch.progress, c.name AS crew_name,
                  (ch.status <> 'active' AND (ch.visibility = 'public' OR c.artwork_visibility = 'public') AND c.deleted_at IS NULL) AS public
           FROM challenges ch LEFT JOIN crews c ON c.id = ch.crew_id WHERE ch.id = $1`,
          [id],
        )
      : null;
    if (!ch) return appPage(res, { status: 404, title: 'Travity', heading: '작품을 찾을 수 없어요', text: '지워졌거나 주소가 바뀌었을 수 있어요.' });
    const appUrl = `travity://a/${id}`;
    if (!ch.public) {
      return appPage(res, { title: 'Travity 작품', heading: '크루원만 볼 수 있는 작품이에요', text: '앱에서 크루에 들어가 있으면 볼 수 있어요.', appUrl });
    }
    const cov = await this.db.many<{ seg_index: number; color: string }>(
      `SELECT seg_index, color FROM challenge_coverage WHERE challenge_id = $1`,
      [id],
    );
    const segs: (string | null)[] = Array(Math.max(0, ch.route_points.length - 1)).fill(null);
    for (const c of cov) if (c.seg_index < segs.length) segs[c.seg_index] = c.color;
    return appPage(res, {
      title: `${ch.title} · Travity`,
      heading: ch.title,
      text: `${ch.crew_name ?? '친구 챌린지'} · 완성도 ${Math.round(ch.progress * 100)}%`,
      body: routeSvg(ch.route_points, segs),
      appUrl,
    });
  }

  @Get('f/:code')
  async friend(@Param('code') codeRaw: string, @Res() res: Response) {
    const code = String(codeRaw ?? '').toUpperCase().slice(0, 6);
    const ch = await this.db.one<{ shape_key: string; creator: string; target_distance_m: number }>(
      `SELECT ch.shape_key, ch.target_distance_m, u.display_name AS creator FROM challenges ch JOIN users u ON u.id = ch.created_by
       WHERE ch.friend_code = $1 AND ch.status = 'active' AND ch.end_at > now()`,
      [code],
    );
    if (!ch) return appPage(res, { status: 404, title: 'Travity', heading: '끝났거나 없는 초대예요', text: '친구에게 새 코드를 받아 주세요.' });
    return appPage(res, {
      title: '함께 그림 그리러 가요 · Travity',
      heading: `${ch.creator}님이 함께 달리자고 해요`,
      text: `${shapeByKey(ch.shape_key)?.label ?? '그림'} · ${Math.round(ch.target_distance_m / 100) / 10}km 친구 챌린지`,
      body: `<div class="code">${esc(code)}</div><p class="muted">앱의 '친구와 달리기'에서 이 코드를 넣어도 돼요.</p>`,
      appUrl: `travity://f/${code}`,
      button: '앱에서 참여하기',
    });
  }

  @Get('c/:code')
  async crew(@Param('code') codeRaw: string, @Res() res: Response) {
    const code = String(codeRaw ?? '').toUpperCase().slice(0, 6);
    const inv = await this.db.one<{ name: string; members: number }>(
      `SELECT c.name, (SELECT count(*)::int FROM crew_members m WHERE m.crew_id = c.id AND m.left_at IS NULL) AS members
       FROM crew_invites i JOIN crews c ON c.id = i.crew_id
       WHERE i.invite_code = $1 AND i.revoked_at IS NULL AND i.expires_at > now() AND c.deleted_at IS NULL`,
      [code],
    );
    if (!inv) return appPage(res, { status: 404, title: 'Travity', heading: '만료된 초대 코드예요', text: '크루장에게 새 코드를 받아 주세요.' });
    return appPage(res, {
      title: `${inv.name} 크루 초대 · Travity`,
      heading: `${inv.name} 크루에 초대받았어요`,
      text: `크루원 ${inv.members}명과 함께 달리면서 그림을 그려요.`,
      body: `<div class="code">${esc(code)}</div><p class="muted">앱의 '초대 코드로 참여'에서 이 코드를 넣어도 돼요.</p>`,
      appUrl: `travity://c/${code}`,
      button: '앱에서 참여하기',
    });
  }
}
