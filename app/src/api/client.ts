import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { useAuth } from '../store/auth';

function baseUrl() {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
  if (Platform.OS === 'web') return `http://${typeof location !== 'undefined' ? location.hostname : 'localhost'}:3000`;
  // Expo Go: 개발 서버와 같은 PC에서 API가 돈다고 본다
  const host = Constants.expoConfig?.hostUri?.split(':')[0] ?? 'localhost';
  return `http://${host}:3000`;
}

export const API_URL = baseUrl();

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

let refreshing: Promise<boolean> | null = null;

async function refresh(): Promise<boolean> {
  const { refreshToken, setTokens, logout } = useAuth.getState();
  if (!refreshToken) return false;
  const r = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!r.ok) {
    logout();
    return false;
  }
  setTokens(await r.json());
  return true;
}

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown } = {}, retry = true): Promise<T> {
  const token = useAuth.getState().accessToken;
  let res: Response;
  // 서버에 닿지 않을 때 로딩이 끝없이 돌지 않게 15초에서 끊는다
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15_000);
  try {
    res = await fetch(`${API_URL}${path}`, {
      signal: ctrl.signal,
      method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET'),
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError(`서버(${API_URL})에 연결하지 못했어요. 연결 상태를 확인하고 다시 시도해 주세요.`, 0);
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 401 && retry && token) {
    refreshing ??= refresh().finally(() => (refreshing = null));
    if (await refreshing) return api<T>(path, opts, false);
  }
  if (!res.ok) {
    let msg = '잠시 뒤에 다시 시도해 주세요.';
    try {
      const j = await res.json();
      msg = Array.isArray(j.message) ? j.message[0] : (j.message ?? msg);
    } catch {}
    throw new ApiError(msg, res.status);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}
