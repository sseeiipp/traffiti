import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthUser } from '../auth/auth.guard.js';
import { UsersService } from './users.service.js';

/** 다른 사람: 유저 찾기(32) · 유저 프로필(33) · 신고 */
@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class PeopleController {
  constructor(private readonly users: UsersService) {}

  @Get('search')
  search(@CurrentUser() u: AuthUser, @Query('q') q = '', @Query('crewId') crewId?: string) {
    return this.users.search(u.id, q, crewId ? Number(crewId) : undefined);
  }

  @Get(':id/profile')
  profile(@CurrentUser() u: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.users.profile(u.id, id);
  }

  @HttpCode(200)
  @Post(':id/reports')
  report(@CurrentUser() u: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() b: { reason: string; detail?: string }) {
    return this.users.report(u.id, id, b);
  }
}
