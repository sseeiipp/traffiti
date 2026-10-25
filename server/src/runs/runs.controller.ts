import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthUser } from '../auth/auth.guard.js';
import { RunsService } from './runs.service.js';

@ApiTags('runs')
@ApiBearerAuth()
@Controller('runs')
export class RunsController {
  constructor(private readonly runs: RunsService) {}

  @Post()
  start(@CurrentUser() u: AuthUser, @Body() b: { clientId: string; challengeId?: number; startedAt?: number }) {
    return this.runs.start(u.id, b);
  }

  @Get()
  month(@CurrentUser() u: AuthUser, @Query('month') month: string) {
    return this.runs.month(u.id, month);
  }

  @Get('unfinished')
  unfinished(@CurrentUser() u: AuthUser) {
    return this.runs.unfinished(u.id);
  }

  @HttpCode(200)
  @Post(':id/points')
  points(@CurrentUser() u: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() b: { points: any[] }) {
    return this.runs.addPoints(u.id, id, b.points);
  }

  @HttpCode(200)
  @Post(':id/finish')
  finish(@CurrentUser() u: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.runs.finish(u.id, id);
  }

  @Get(':id')
  detail(@CurrentUser() u: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.runs.detail(u.id, id);
  }
}
