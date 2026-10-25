import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { api, API_URL } from './client';
import type { Provider } from '../store/auth';

// 웹에서 로그인 팝업이 돌아왔을 때 창을 닫고 결과를 넘긴다(앱에서는 아무 일도 안 한다)
WebBrowser.maybeCompleteAuthSession();

export type SocialCred = { ticket: string } | { subject: string };

/** 사용자가 로그인 창을 닫았을 때. 오류 문구 없이 조용히 끝낸다 */
export class SocialCancelled extends Error {}

async function enabled(provider: Provider): Promise<{ real: boolean; demo: boolean }> {
  try {
    const r = await api<Record<string, boolean>>('/auth/oauth/providers');
    return { real: !!r[provider], demo: r.demo !== false };
  } catch {
    // 이 기능이 없는 예전 서버이거나 잠깐 안 닿을 때는 데모로
    return { real: false, demo: true };
  }
}

/**
 * 카카오·네이버·구글 로그인 창을 열고, 서버가 회원 번호를 확인해 준 로그인 표(ticket)를 받아 온다.
 * 서버에 그 제공자 키가 없거나 로그인 중 문제가 생기면, 시연이 멈추지 않게 데모 로그인(기기 식별자)으로 넘어간다.
 */
export async function socialCredential(provider: Provider, deviceId: string): Promise<SocialCred> {
  const demo = { subject: `${provider}:${deviceId}` };
  const on = await enabled(provider);
  if (!on.real) return demo;

  const returnUrl = Linking.createURL('oauth');
  // 안드로이드에서 앱이 앞으로 오면서 로그인 창이 '닫힘'으로 먼저 끝나 버리는 경우가 있어, 들어온 주소를 따로도 받아 둔다
  let arrived: string | null = null;
  const sub = Linking.addEventListener('url', (e) => {
    if (e.url.startsWith(returnUrl)) arrived = e.url;
  });
  let url: string | null;
  try {
    const res = await WebBrowser.openAuthSessionAsync(
      `${API_URL}/auth/oauth/${provider}/start?redirect=${encodeURIComponent(returnUrl)}`,
      returnUrl,
    );
    if (res.type !== 'success') await new Promise((r) => setTimeout(r, 500));
    url = res.type === 'success' ? res.url : arrived;
  } finally {
    sub.remove();
  }
  if (!url) throw new SocialCancelled();
  const q = Linking.parse(url).queryParams ?? {};
  if (typeof q.ticket === 'string' && q.ticket) return { ticket: q.ticket };
  if (q.error === 'cancelled') throw new SocialCancelled();
  console.warn(`[social] ${provider} 실제 로그인 실패(${q.error}), 데모 로그인으로 진행`);
  if (on.demo) return demo;
  throw new Error('로그인하지 못했어요. 잠시 뒤에 다시 시도해 주세요.');
}
