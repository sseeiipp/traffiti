import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { storage } from './storage';

export type Provider = 'email' | 'kakao' | 'naver' | 'google';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  /** 01 위치 안내를 본 적 있는지 */
  introSeen: boolean;
  /** 소셜 데모 로그인용 기기 식별자 */
  deviceId: string;
  /** 지금 보고 있는 크루(대표 크루와 다를 수 있다) */
  crewId: number | null;
  /** 가입 진행 중인 정보(03-0 → 03-1 → 03-2) */
  signup: {
    provider: Provider;
    terms?: { tos: boolean; location: boolean; marketing: boolean };
    /** 소셜 가입: 서버가 준 로그인 표(ticket) 또는 데모 식별자 */
    cred?: { ticket: string } | { subject: string };
    /** 소셜 계정의 닉네임(가입 화면 이름 칸에 미리 채운다) */
    suggestedName?: string;
  } | null;
  hydrated: boolean;
  setTokens: (t: { accessToken: string; refreshToken: string }) => void;
  logout: () => void;
  set: (p: Partial<AuthState>) => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      introSeen: false,
      deviceId: `device-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`,
      crewId: null,
      signup: null,
      hydrated: false,
      setTokens: (t) => set({ accessToken: t.accessToken, refreshToken: t.refreshToken }),
      logout: () => set({ accessToken: null, refreshToken: null, crewId: null, signup: null }),
      set: (p) => set(p),
    }),
    {
      name: 'crew-auth',
      storage,
      partialize: ({ accessToken, refreshToken, introSeen, deviceId, crewId }) => ({ accessToken, refreshToken, introSeen, deviceId, crewId }),
      onRehydrateStorage: () => () => useAuth.setState({ hydrated: true }),
    },
  ),
);
