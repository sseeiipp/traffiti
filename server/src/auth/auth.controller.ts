import { Body, Controller, Get, HttpCode, Logger, Param, Post, Query, Res } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { config } from '../config.js';
import { DbService } from '../db/db.service.js';
import { appPage, esc } from '../common/page.js';
import { mailHtml, sendMail } from '../mail/mail.js';
import { CurrentUser, Public, type AuthUser } from './auth.guard.js';
import { AuthService, type Provider } from './auth.service.js';
import { authorizeUrl, fetchProfile, isAllowedReturn, isConfigured, OAUTH_PROVIDERS, withQuery, type OAuthProvider } from './oauth.js';

/**
 * 로그인을 마치고 앱(exp://, travity://)으로 돌아간다.
 * 302로 앱 주소에 바로 보내면, 구글처럼 동의 화면이 스크립트로 넘기는 경우 안드로이드 브라우저(Chrome 탭·삼성 인터넷)가
 * 사용자가 누르지 않은 앱 열기를 막아서 화면이 멈춘 것처럼 보인다. 그래서 페이지를 하나 띄워 바로 넘겨 보고,
 * 막히면 사용자가 버튼을 눌러 돌아가게 한다.
 */
function backToApp(res: Response, url: string) {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  // 삼성 인터넷 탭은 travity:// 같은 앱 주소를 눌러도 앱을 안 여는 경우가 있어,
  // 안드로이드에서는 어느 앱을 열지 패키지까지 적은 intent:// 주소를 쓴다
  const m = /^(travity|exps?):\/\/(.*)$/.exec(url);
  const pkg = m?.[1] === 'travity' ? 'com.travity.app' : 'host.exp.exponent';
  const intent = m ? `intent://${m[2].replace(/#/g, '%23')}#Intent;scheme=${m[1]};package=${pkg};end` : url;
  const href = esc(url);
  res
    .status(200)
    .type('html')
    .set('cache-control', 'no-store')
    .send(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Traffiti로 돌아가기</title>
<style>body{margin:0;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;font-family:system-ui,sans-serif;background:#fff;color:#111}
a{display:block;padding:16px 32px;border-radius:999px;background:#A3E635;color:#111;font-weight:700;font-size:17px;text-decoration:none}p{margin:0;color:#666;font-size:15px}</style></head>
<body><p>앱으로 돌아가는 중이에요</p><a id="go" href="${href}">앱으로 돌아가기</a>
<script>var a=document.getElementById('go');if(/Android/i.test(navigator.userAgent))a.href=${JSON.stringify(intent).replace(/</g, '\\u003c')};location.href=a.href</script></body></html>`);
}

/** 시연 중 소셜 로그인이 어디서 끊기는지 보려고 남기는 최근 기록(토큰·회원 번호는 넣지 않는다) */
const trace: { at: string; p: string; step: string; detail?: string }[] = [];
function note(p: string, step: string, detail?: string) {
  trace.unshift({ at: new Date().toISOString(), p, step, detail: detail?.slice(0, 200) });
  trace.length = Math.min(trace.length, 30);
}

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
  async signup(@Body() b: { email: string; password: string; name: string; terms: any }) {
    const out = await this.auth.signupEmail(b);
    // 인증 메일은 가입을 막지 않는다. 늦게 와도 설정에서 다시 보낼 수 있다
    void this.sendVerify((b.email ?? '').trim().toLowerCase());
    return out;
  }

  private async sendVerify(email: string) {
    const u = await this.db.one<{ id: number; verified: boolean }>(
      `SELECT id, email_verified_at IS NOT NULL AS verified FROM users WHERE email = $1 AND deleted_at IS NULL`,
      [email],
    );
    if (!u || u.verified) return false;
    const token = this.jwt.sign({ sub: u.id, typ: 'verify', e: email }, { expiresIn: '3d' });
    const link = `${config.publicUrl}/auth/email/verify?token=${encodeURIComponent(token)}`;
    await sendMail(
      email,
      '[Travity] 이메일 주소를 확인해 주세요',
      mailHtml('이메일 주소를 확인해 주세요', 'Travity에 가입해 주셔서 고마워요. 아래 버튼을 누르면 이 주소로 비밀번호 재설정 메일을 받을 수 있어요.', '이메일 인증하기', link),
      link,
    );
    return true;
  }

  /** 인증 메일을 다시 보낸다 */
  @HttpCode(200)
  @Post('email/verify/resend')
  async resendVerify(@CurrentUser() me: AuthUser) {
    const u = await this.db.one<{ email: string | null }>(`SELECT email FROM users WHERE id = $1`, [me.id]);
    return { sent: u?.email ? await this.sendVerify(u.email) : false };
  }

  /** 메일의 인증 버튼이 여는 주소 */
  @Public()
  @Get('email/verify')
  async verify(@Query('token') token: string, @Res() res: Response) {
    try {
      const p = this.jwt.verify<{ sub: number; typ: string; e: string }>(token ?? '');
      if (p.typ !== 'verify') throw new Error();
      await this.db.pool.query(
        `UPDATE users SET email_verified_at = COALESCE(email_verified_at, now()) WHERE id = $1 AND email = $2`,
        [p.sub, p.e],
      );
      return appPage(res, { title: '이메일 인증 완료', heading: '이메일 인증을 마쳤어요', text: '이제 앱으로 돌아가 달리면 돼요.', appUrl: 'travity://', button: '앱으로 돌아가기' });
    } catch {
      return appPage(res, { status: 400, title: '링크 만료', heading: '링크가 만료됐어요', text: '앱의 설정에서 인증 메일을 다시 보내 주세요.' });
    }
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

  @Public()
  @Get('oauth/recent')
  recent() {
    return trace;
  }

  /** 앱이 브라우저로 여는 주소. 제공자 로그인 화면으로 보낸다 */
  @Public()
  @Get('oauth/:provider/start')
  start(@Param('provider') p: string, @Query('redirect') redirect: string, @Res() res: Response) {
    if (!OAUTH_PROVIDERS.includes(p as OAuthProvider) || !isConfigured(p as OAuthProvider)) {
      return res.status(400).send('지원하지 않는 로그인 방식이에요.');
    }
    if (!redirect || !isAllowedReturn(redirect)) return res.status(400).send('돌아갈 앱 주소가 올바르지 않아요.');
    note(p, 'start', redirect.split('?')[0]);
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
      note(p, 'callback-bad-state');
      return res.status(400).send('로그인 시간이 지났어요. 앱에서 다시 시도해 주세요.');
    }
    this.oauthLog.log(`${p} callback ${q.code ? 'code' : `error=${q.error}`}`);
    note(p, 'callback', q.code ? 'code' : `error=${q.error} ${q.error_description ?? ''}`);
    if (q.error || !q.code) {
      // 사용자가 동의 화면에서 취소한 경우도 여기로 온다
      return backToApp(res, withQuery(st.r, { error: q.error === 'access_denied' ? 'cancelled' : (q.error ?? 'no_code') }));
    }
    try {
      const prof = await fetchProfile(p as OAuthProvider, q.code, q.state!);
      const ticket = this.jwt.sign({ typ: 'social', p, s: prof.subject, n: prof.name }, { expiresIn: '30m' });
      note(p, 'profile-ok', prof.name ? 'with name' : 'no name');
      return backToApp(res, withQuery(st.r, { ticket }));
    } catch (e) {
      this.oauthLog.warn(`${p} 로그인 실패: ${(e as Error).message}`);
      note(p, 'profile-fail', (e as Error).message);
      return backToApp(res, withQuery(st.r, { error: 'provider' }));
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

  /** 재설정 링크를 메일로 보낸다. RESEND_API_KEY가 없으면 서버 로그에만 남긴다. */
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
      const link = `${config.publicUrl}/auth/password/reset/open?token=${encodeURIComponent(token)}`;
      const mailed = await sendMail(
        email,
        '[Travity] 비밀번호 재설정 링크',
        mailHtml('비밀번호를 다시 정해 주세요', '아래 버튼을 눌러 새 비밀번호를 정해 주세요. 링크는 30분 동안만 쓸 수 있어요. 요청한 적이 없다면 이 메일은 무시해도 돼요.', '비밀번호 재설정', link),
        link,
      );
      if (!mailed) this.log.log(`reset link for ${email}: travity://reset?token=${token}`);
      // 메일을 못 보내는 개발 환경에서는 앱이 바로 다음 단계로 넘어가게 토큰을 돌려준다
      return { sent: true, devToken: config.prod || mailed ? undefined : token };
    }
    // 가입 여부를 알려주지 않는다
    return { sent: true };
  }

  /** 메일의 재설정 버튼이 여는 페이지. 앱을 열거나, 앱이 없으면 이 페이지에서 바로 바꾼다 */
  @Public()
  @Get('password/reset/open')
  resetOpen(@Query('token') token: string, @Res() res: Response) {
    const t = token ?? '';
    const form = `<form id="f" style="width:100%;display:flex;flex-direction:column;gap:10px">
<input id="pw" type="password" minlength="8" placeholder="새 비밀번호(8자 이상)" autocomplete="new-password" required>
<button class="btn" type="submit" style="background:#111;color:#fff">웹에서 바로 바꾸기</button><p id="msg" class="muted"></p></form>
<script>document.getElementById('f').onsubmit=async function(e){e.preventDefault();var m=document.getElementById('msg');m.textContent='바꾸는 중…';
try{var r=await fetch('${esc(config.publicUrl)}/auth/password/confirm',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token:${JSON.stringify(t).replace(/</g, '\\u003c')},password:document.getElementById('pw').value})});
var j=await r.json();m.textContent=j.ok?'바꿨어요. 앱에서 새 비밀번호로 로그인해 주세요.':(j.message||'다시 시도해 주세요.');}catch(_){m.textContent='연결이 끊겼어요. 다시 시도해 주세요.'}};</script>`;
    return appPage(res, {
      title: '비밀번호 재설정',
      heading: '비밀번호 재설정',
      text: '앱에서 열거나, 여기서 바로 새 비밀번호를 정할 수 있어요.',
      appUrl: `travity://reset?token=${encodeURIComponent(t)}`,
      button: '앱에서 열기',
      body: form,
    });
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
