import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser, Public, type AuthUser } from '../auth/auth.guard.js';
import { config } from '../config.js';
import { DbService } from '../db/db.service.js';

const MAX_BYTES = 1_500_000;
const MIMES = ['image/jpeg', 'image/png', 'image/webp'];

/** 이 서버에 올린 사진 주소인지(다른 곳의 주소를 사진으로 저장하지 못하게 한다). null은 사진 지우기 */
export function photoUrlOf(url: unknown): string | null {
  if (url === null || url === '') return null;
  const ok =
    typeof url === 'string' &&
    url.startsWith(`${config.publicUrl}/images/`) &&
    /\/images\/\d+$/.test(url);
  if (!ok) throw new BadRequestException('사진을 다시 올려 주세요.');
  return url as string;
}

@ApiTags('images')
@Controller('images')
export class ImagesController {
  constructor(private readonly db: DbService) {}

  /** 앱이 줄여서 보낸 사진(base64)을 저장하고 주소를 돌려준다 */
  @ApiBearerAuth()
  @Post()
  async upload(
    @CurrentUser() u: AuthUser,
    @Body() b: { mime?: string; base64?: string },
  ) {
    const mime = b.mime ?? 'image/jpeg';
    if (!MIMES.includes(mime) || typeof b.base64 !== 'string')
      throw new BadRequestException('사진 파일을 올려 주세요.');
    const data = Buffer.from(b.base64, 'base64');
    if (!data.length) throw new BadRequestException('사진을 읽지 못했어요.');
    if (data.length > MAX_BYTES)
      throw new BadRequestException(
        '사진이 너무 커요. 다른 사진을 골라 주세요.',
      );
    const r = await this.db.one<{ id: number }>(
      `INSERT INTO images (owner_id, mime, data) VALUES ($1, $2, $3) RETURNING id`,
      [u.id, mime, data],
    );
    return { url: `${config.publicUrl}/images/${r!.id}` };
  }

  @Public()
  @Get(':id')
  async get(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    const r = await this.db.one<{ mime: string; data: Buffer }>(
      `SELECT mime, data FROM images WHERE id = $1`,
      [id],
    );
    if (!r) throw new NotFoundException();
    // 한 번 올린 사진은 바뀌지 않는다(바꾸면 새 주소)
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.type(r.mime).send(r.data);
  }
}
