import { Controller, ForbiddenException, Get, HttpCode, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthUser } from '../auth/auth.guard.js';
import { config } from '../config.js';
import { RankingsService } from './rankings.service.js';

@ApiTags('rankings')
@ApiBearerAuth()
@Controller('rankings')
export class RankingsController {
  constructor(private readonly rankings: RankingsService) {}

  @Get()
  get(@CurrentUser() u: AuthUser, @Query() q: { type?: string; period?: string; month?: string; category?: string; search?: string }) {
    return this.rankings.get(u.id, q);
  }

  @Get('categories')
  categories() {
    return this.rankings.categories();
  }

  @HttpCode(200)
  @Post('recompute')
  recompute() {
    if (config.prod) throw new ForbiddenException();
    return this.rankings.recomputeNow();
  }
}
