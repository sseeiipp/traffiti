import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthUser } from '../auth/auth.guard.js';
import { ChallengesService, type RouteInput } from './challenges.service.js';

@ApiTags('challenges')
@ApiBearerAuth()
@Controller()
export class ChallengesController {
  constructor(private readonly ch: ChallengesService) {}

  @Get('shapes')
  shapes() {
    return this.ch.library();
  }

  @HttpCode(200)
  @Post('routes/suggest')
  suggest(@Body() b: RouteInput) {
    return this.ch.suggest(b);
  }

  @Post('crews/:crewId/challenges')
  create(@CurrentUser() u: AuthUser, @Param('crewId', ParseIntPipe) crewId: number, @Body() b: any) {
    return this.ch.create(u.id, crewId, b);
  }

  @Get('crews/:crewId/challenges/current')
  current(@CurrentUser() u: AuthUser, @Param('crewId', ParseIntPipe) crewId: number) {
    return this.ch.current(u.id, crewId);
  }

  @Get('challenges/:id')
  view(@CurrentUser() u: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.ch.view(u.id, id);
  }

  @HttpCode(200)
  @Post('challenges/:id/cancel')
  cancel(@CurrentUser() u: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.ch.cancel(u.id, id);
  }

  @Delete('challenges/:id')
  remove(@CurrentUser() u: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.ch.remove(u.id, id);
  }

  @Patch('challenges/:id/category')
  category(@CurrentUser() u: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() b: { name: string }) {
    return this.ch.setCategory(u.id, id, b.name);
  }

  @Get('categories')
  categories() {
    return this.ch.categories();
  }

  @Post('friend-challenges')
  createFriend(@CurrentUser() u: AuthUser, @Body() b: any) {
    return this.ch.createFriend(u.id, b);
  }

  @Get('friend-challenges/current')
  currentFriend(@CurrentUser() u: AuthUser) {
    return this.ch.currentFriend(u.id);
  }

  @Get('friend-challenges/:code')
  previewFriend(@Param('code') code: string) {
    return this.ch.previewFriend(code);
  }

  @HttpCode(200)
  @Post('friend-challenges/:code/join')
  joinFriend(@CurrentUser() u: AuthUser, @Param('code') code: string) {
    return this.ch.joinFriend(u.id, code);
  }

  @HttpCode(200)
  @Post('challenges/:id/extend')
  extendFriend(@CurrentUser() u: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.ch.extendFriend(u.id, id);
  }

  @HttpCode(200)
  @Post('challenges/:id/finish')
  finishFriend(@CurrentUser() u: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.ch.finishFriend(u.id, id);
  }

  @Post('challenges/:id/to-crew')
  toCrew(@CurrentUser() u: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() b: { name: string }) {
    return this.ch.friendToCrew(u.id, id, b.name);
  }

  @Get('artworks')
  artworks(@CurrentUser() u: AuthUser, @Query('scope') scope = 'all', @Query('crewId') crewId?: string) {
    return this.ch.artworks(u.id, scope as any, crewId ? Number(crewId) : undefined);
  }
}
