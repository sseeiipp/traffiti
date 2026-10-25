import { Body, Controller, Delete, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthUser } from '../auth/auth.guard.js';
import { UsersService } from './users.service.js';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users/me')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  me(@CurrentUser() u: AuthUser) {
    return this.users.me(u.id);
  }

  @Patch()
  update(@CurrentUser() u: AuthUser, @Body() b: { name?: string; hasPhoto?: boolean; photoUrl?: string | null }) {
    return this.users.update(u.id, b);
  }

  @Patch('settings')
  settings(@CurrentUser() u: AuthUser, @Body() b: Record<string, unknown>) {
    return this.users.updateSettings(u.id, b);
  }

  @Delete()
  remove(@CurrentUser() u: AuthUser) {
    return this.users.remove(u.id);
  }
}
