import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthUser } from '../auth/auth.guard.js';
import { CrewsService } from './crews.service.js';

@ApiTags('crews')
@ApiBearerAuth()
@Controller()
export class CrewsController {
  constructor(private readonly crews: CrewsService) {}

  @Get('crews')
  mine(@CurrentUser() u: AuthUser) {
    return this.crews.myCrews(u.id);
  }

  @Post('crews')
  create(@CurrentUser() u: AuthUser, @Body() b: { name: string; hasPhoto?: boolean; color?: string; region?: string }) {
    return this.crews.create(u.id, b);
  }

  @HttpCode(200)
  @Post('crews/preview-code')
  preview(@CurrentUser() u: AuthUser, @Body() b: { code: string }) {
    return this.crews.previewCode(u.id, b.code);
  }

  @HttpCode(200)
  @Post('crews/join-by-code')
  join(@CurrentUser() u: AuthUser, @Body() b: { code: string }) {
    return this.crews.joinByCode(u.id, b.code);
  }

  @Patch('users/me/primary-crew')
  primary(@CurrentUser() u: AuthUser, @Body() b: { crewId: number }) {
    return this.crews.setPrimary(u.id, Number(b.crewId));
  }

  @HttpCode(200)
  @Post('crew-invites/:id/accept')
  acceptInvite(@CurrentUser() u: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.crews.acceptInvite(u.id, id);
  }

  @Get('crews/:id')
  detail(@CurrentUser() u: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.crews.detail(u.id, id);
  }

  @Patch('crews/:id')
  update(@CurrentUser() u: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() b: any) {
    return this.crews.update(u.id, id, b);
  }

  @Delete('crews/:id')
  remove(@CurrentUser() u: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() b: { confirmName: string }) {
    return this.crews.remove(u.id, id, b?.confirmName);
  }

  @HttpCode(200)
  @Post('crews/:id/leave')
  leave(@CurrentUser() u: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.crews.leave(u.id, id);
  }

  @Post('crews/:id/invites')
  invite(@CurrentUser() u: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.crews.renewInvite(u.id, id);
  }

  @Patch('crews/:id/me')
  me(@CurrentUser() u: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() b: { color?: string; notify?: boolean }) {
    if (b.color !== undefined) return this.crews.setMyColor(u.id, id, b.color);
    return this.crews.setMyNotify(u.id, id, !!b.notify);
  }

  @HttpCode(200)
  @Post('crews/:id/requests/:rid')
  decide(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Param('rid', ParseIntPipe) rid: number,
    @Body() b: { accept: boolean },
  ) {
    return this.crews.decideRequest(u.id, id, rid, !!b.accept);
  }

  @Patch('crews/:id/members/:memberId/role')
  role(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Param('memberId', ParseIntPipe) memberId: number,
  ) {
    return this.crews.transferLeader(u.id, id, memberId);
  }

  @Delete('crews/:id/members/:memberId')
  kick(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Param('memberId', ParseIntPipe) memberId: number,
  ) {
    return this.crews.removeMember(u.id, id, memberId);
  }

  @HttpCode(200)
  @Post('crews/:id/invites/users/:userId')
  inviteUser(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Param('userId', ParseIntPipe) userId: number,
    @Body() b: { on?: boolean },
  ) {
    return this.crews.inviteUser(u.id, id, userId, b?.on !== false);
  }

  @Post('crews/:id/reports')
  report(@CurrentUser() u: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() b: { reason: string; detail?: string }) {
    return this.crews.report(u.id, id, b);
  }

  @Get('crews/:id/level')
  level(@Param('id', ParseIntPipe) id: number) {
    return this.crews.level(id);
  }

  @Get('crews/:id/collection')
  collection(@CurrentUser() u: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.crews.collection(u.id, id);
  }
}
