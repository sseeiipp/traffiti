import { config } from '../config.js';

/**
 * 카카오·네이버·구글 로그인(OAuth 2.0 인가 코드 방식).
 * 앱(Expo Go)에는 네이티브 SDK를 넣을 수 없어서, 브라우저로 제공자 로그인 화면을 열고
 * 제공자가 이 서버의 /auth/oauth/:provider/callback으로 코드를 돌려주면
 * 서버가 비밀키로 코드를 토큰으로 바꾸고 회원 번호(subject)를 직접 받아 온다.
 * 앱은 subject를 만들지 않으므로 다른 사람으로 로그인할 수 없다.
 */
export type OAuthProvider = 'kakao' | 'naver' | 'google';

export const OAUTH_PROVIDERS: OAuthProvider[] = ['kakao', 'naver', 'google'];

export interface OAuthProfile {
  subject: string;
  name?: string;
}

const AUTHORIZE: Record<OAuthProvider, string> = {
  kakao: 'https://kauth.kakao.com/oauth/authorize',
  naver: 'https://nid.naver.com/oauth2.0/authorize',
  google: 'https://accounts.google.com/o/oauth2/v2/auth',
};

const TOKEN: Record<OAuthProvider, string> = {
  kakao: 'https://kauth.kakao.com/oauth/token',
  naver: 'https://nid.naver.com/oauth2.0/token',
  google: 'https://oauth2.googleapis.com/token',
};

export function isConfigured(p: OAuthProvider) {
  const c = config.oauth[p];
  // 카카오는 Client Secret을 켜지 않으면 비밀키 없이도 된다
  return !!c.id && (p === 'kakao' || !!c.secret);
}

export function callbackUrl(p: OAuthProvider) {
  return `${config.publicUrl}/auth/oauth/${p}/callback`;
}

export function authorizeUrl(p: OAuthProvider, state: string) {
  const q = new URLSearchParams({
    response_type: 'code',
    client_id: config.oauth[p].id,
    redirect_uri: callbackUrl(p),
    state,
  });
  if (p === 'google') {
    q.set('scope', 'openid profile');
    q.set('prompt', 'select_account');
  }
  return `${AUTHORIZE[p]}?${q}`;
}

async function json(res: Response, what: string) {
  const body = (await res.json().catch(() => ({}))) as any;
  if (!res.ok || body.error) {
    throw new Error(`${what} 실패(${res.status}): ${body.error_description ?? body.error ?? body.msg ?? ''}`);
  }
  return body;
}

/** 인가 코드를 액세스 토큰으로 바꾸고, 그 토큰으로 회원 정보를 받아 온다 */
export async function fetchProfile(p: OAuthProvider, code: string, state: string): Promise<OAuthProfile> {
  const c = config.oauth[p];
  const form = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: c.id,
    redirect_uri: callbackUrl(p),
    code,
  });
  if (c.secret) form.set('client_secret', c.secret);
  if (p === 'naver') form.set('state', state);
  const token = await json(
    await fetch(TOKEN[p], {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded;charset=utf-8' },
      body: form,
      signal: AbortSignal.timeout(10_000),
    }),
    '토큰 발급',
  );
  const auth = { authorization: `Bearer ${token.access_token}` };
  const get = async (url: string) => json(await fetch(url, { headers: auth, signal: AbortSignal.timeout(10_000) }), '회원 정보 조회');

  if (p === 'kakao') {
    const me = await get('https://kapi.kakao.com/v2/user/me');
    return { subject: String(me.id), name: me.kakao_account?.profile?.nickname ?? me.properties?.nickname };
  }
  if (p === 'naver') {
    const me = await get('https://openapi.naver.com/v1/nid/me');
    if (!me.response?.id) throw new Error('네이버 회원 정보에 id가 없어요.');
    return { subject: String(me.response.id), name: me.response.nickname ?? me.response.name };
  }
  const me = await get('https://openidconnect.googleapis.com/v1/userinfo');
  if (!me.sub) throw new Error('구글 회원 정보에 sub가 없어요.');
  return { subject: String(me.sub), name: me.given_name ?? me.name };
}

/**
 * 로그인을 마친 뒤 돌아갈 앱 주소인지 확인한다. 아무 주소나 받으면 로그인 표(ticket)가 남의 사이트로 샌다.
 * travity://는 빌드한 앱, exp://는 Expo Go(시연용), localhost·CORS_ORIGINS는 웹.
 */
export function isAllowedReturn(url: string) {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol === 'travity:' || u.protocol === 'exp:' || u.protocol === 'exps:') return true;
  if ((u.protocol === 'http:' || u.protocol === 'https:') && (u.hostname === 'localhost' || u.hostname === '127.0.0.1')) return true;
  return config.corsOrigins.includes(u.origin);
}

export function withQuery(url: string, params: Record<string, string>) {
  return `${url}${url.includes('?') ? '&' : '?'}${new URLSearchParams(params)}`;
}
