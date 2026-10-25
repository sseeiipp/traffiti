import { Body, Controller, HttpCode, Logger, Post } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ApiTags } from '@nestjs/swagger';
import { config } from '../config.js';
import { DbService } from '../db/db.service.js';
import { Public } from './auth.guard.js';
import { AuthService, type Provider } from './auth.service.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly log = new Logger('PasswordReset');

  constructor(
    private readonly auth: AuthService,
    private readonly db: DbService,
    private readonly jwt: JwtService,
  ) {}

  @Public()
  @Post('signup')
  signup(@Body() b: { email: string; password: string; name: string; terms: any }) {
    return this.auth.signupEmail(b);
  }

  @Public()
  @HttpCode(200)
  @Post('login')
  login(@Body() b: { email: string; password: string }) {
    return this.auth.loginEmail(b.email, b.password);
  }

  @Public()
  @HttpCode(200)
  @Post('social')
  social(@Body() b: { provider: Provider; subject: string; signup?: { name: string; terms: any } }) {
    return this.auth.social(b.provider, b.subject, b.signup);
  }

  @Public()
  @HttpCode(200)
  @Post('refresh')
  refresh(@Body() b: { refreshToken: string }) {
    return this.auth.refresh(b.refreshToken);
  }

  @HttpCode(204)
  @Post('logout')
  logout() {
    // 토큰은 기기에서 지운다. 서버 쪽 폐기 목록은 MVP 범위 밖.
  }

  /** 재설정 링크를 보낸다. 메일 발송 연동 전이라 링크 토큰은 서버 로그에만 남긴다. */
  @Public()
  @HttpCode(200)
  @Post('password/reset')
  async reset(@Body() b: { email: string }) {
    const email = (b.email ?? '').trim().toLowerCase();
    const u = await this.db.one<{ id: number }>(
      `SELECT user_id AS id FROM user_auth_accounts WHERE provider = 'email' AND provider_subject = $1`,
      [email],
    );
    if (u) {
      const token = this.jwt.sign({ sub: u.id, typ: 'reset' }, { expiresIn: '30m' });
      this.log.log(`reset link for ${email}: travity://reset?token=${token}`);
      return { sent: true, devToken: config.prod ? undefined : token };
    }
    // 가입 여부를 알려주지 않는다
    return { sent: true };
  }

  @Public()
  @HttpCode(200)
  @Post('password/confirm')
  async confirm(@Body() b: { token: string; password: string }) {
    let sub: number;
    try {
      const p = this.jwt.verify<{ sub: number; typ: string }>(b.token);
      if (p.typ !== 'reset') throw new Error();
      sub = p.sub;
    } catch {
      return { ok: false, message: '링크가 만료됐어요. 다시 요청해 주세요.' };
    }
    await this.auth.changePassword(sub, b.password);
    return { ok: true };
  }
}
