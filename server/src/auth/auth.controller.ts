import { Body, Controller, Get, HttpCode, Logger, Param, Post, Query, Res } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { config } from '../config.js';
import { DbService } from '../db/db.service.js';
import { Public } from './auth.guard.js';
import { AuthService, type Provider } from './auth.service.js';
import { authorizeUrl, fetchProfile, isAllowedReturn, isConfigured, OAUTH_PROVIDERS, withQuery, type OAuthProvider } from './oauth.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly log = new Logger('PasswordReset');
  private readonly oauthLog = new Logger('OAuth');

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

  /** 실제 로그인을 열어 둔 제공자. 꺼진 제공자는 앱이 데모 로그인으로 넘어간다 */
  @Public()
  @Get('oauth/providers')
  providers() {
    return {
      ...Object.fromEntries(OAUTH_PROVIDERS.map((p) => [p, isConfigured(p)])),
      demo: config.socialLoginDemo,
    };
  }

  /** 앱이 브라우저로 여는 주소. 제공자 로그인 화면으로 보낸다 */
  @Public()
  @Get('oauth/:provider/start')
  start(@Param('provider') p: string, @Query('redirect') redirect: string, @Res() res: Response) {
    if (!OAUTH_PROVIDERS.includes(p as OAuthProvider) || !isConfigured(p as OAuthProvider)) {
      return res.status(400).send('지원하지 않는 로그인 방식이에요.');
    }
    if (!redirect || !isAllowedReturn(redirect)) return res.status(400).send('돌아갈 앱 주소가 올바르지 않아요.');
    const state = this.jwt.sign({ typ: 'oauth', p, r: redirect }, { expiresIn: '10m' });
    return res.redirect(302, authorizeUrl(p as OAuthProvider, state));
  }

  /** 제공자가 돌려보내는 주소. 회원 번호를 확인하고 짧게 쓰는 로그인 표(ticket)를 들려 앱으로 돌려보낸다 */
  @Public()
  @Get('oauth/:provider/callback')
  async callback(
    @Param('provider') p: string,
    @Query() q: { code?: string; state?: string; error?: string; error_description?: string },
    @Res() res: Response,
  ) {
    let st: { typ: string; p: string; r: string };
    try {
      st = this.jwt.verify(q.state ?? '');
      if (st.typ !== 'oauth' || st.p !== p || !isAllowedReturn(st.r)) throw new Error();
    } catch {
      return res.status(400).send('로그인 시간이 지났어요. 앱에서 다시 시도해 주세요.');
    }
    if (q.error || !q.code) {
      // 사용자가 동의 화면에서 취소한 경우도 여기로 온다
      return res.redirect(302, withQuery(st.r, { error: q.error === 'access_denied' ? 'cancelled' : (q.error ?? 'no_code') }));
    }
    try {
      const prof = await fetchProfile(p as OAuthProvider, q.code, q.state!);
      const ticket = this.jwt.sign({ typ: 'social', p, s: prof.subject, n: prof.name }, { expiresIn: '30m' });
      return res.redirect(302, withQuery(st.r, { ticket }));
    } catch (e) {
      this.oauthLog.warn(`${p} 로그인 실패: ${(e as Error).message}`);
      return res.redirect(302, withQuery(st.r, { error: 'provider' }));
    }
  }

  /**
   * 소셜 로그인. ticket은 위 callback이 준 것이고, subject는 데모 모드(SOCIAL_LOGIN_DEMO)에서만 받는다.
   */
  @Public()
  @HttpCode(200)
  @Post('social')
  social(@Body() b: { provider: Provider; ticket?: string; subject?: string; signup?: { name: string; terms: any } }) {
    return this.auth.social(b.provider, { ticket: b.ticket, subject: b.subject }, b.signup);
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
