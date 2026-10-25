import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { LatLng } from '../map/MapArt';
import { useAuth } from '../store/auth';
import { api } from './client';

// ---------- 타입(서버 응답) ----------

export interface Me {
  id: number;
  name: string;
  email: string | null;
  provider: 'email' | 'kakao' | 'naver' | 'google';
  hasPhoto: boolean;
  settings: {
    region: string;
    regionAuto: boolean;
    distanceUnit: 'km' | 'mi';
    notifyNewChallenge: boolean;
    notifySegment: boolean;
    notifyArtwork: boolean;
    gpsVisibility: 'me' | 'crew';
    artworkVisibility: 'crew' | 'all';
    hideStartOnShare: boolean;
  };
  leaderOf: { id: number; name: string; hasOthers: boolean }[];
}

export interface CrewSummary {
  id: number;
  name: string;
  hasPhoto: boolean;
  color: string;
  region: string;
  role: 'leader' | 'member';
  myColor: string;
  members: number;
  activeChallenge: { id: number; title: string; progress: number; endAt: string } | null;
}

export interface MyCrews {
  max: number;
  primaryCrewId: number | null;
  crews: CrewSummary[];
  invites: { id: number; crewId: number; name: string }[];
}

export interface Member {
  id: number;
  name: string;
  role: 'leader' | 'member';
  color: string;
  isMe: boolean;
  joinedAt: string;
  monthKm: number;
  monthRuns: number;
}

export interface CrewDetail {
  id: number;
  name: string;
  intro: string;
  hasPhoto: boolean;
  color: string;
  region: string;
  since: string;
  level: { totalXp: number; level: number; into: number; toNext: number; title: string };
  memberCount: number;
  isMember: boolean;
  myRole?: 'leader' | 'member';
  leaderName?: string | null;
  joinPolicy?: 'code' | 'approve';
  challengePermission?: 'leader' | 'all';
  artworkVisibility?: 'crew' | 'public';
  discoverable?: boolean;
  myNotify?: boolean;
  activeChallenge?: { id: number; title: string; shapeKey: string; progress: number; endAt: string } | null;
  members: Member[];
  joinRequests?: { id: number; userId: number; name: string; createdAt: string }[];
  invite?: { code: string; expiresAt: string } | null;
  monthKm?: number;
}

export interface Contributor {
  userId: number | null;
  name: string;
  isMe: boolean;
  color: string;
  km: number;
  share: number;
  part: string;
}

export interface Challenge {
  id: number;
  crewId: number | null;
  crewName: string | null;
  isFriend: boolean;
  friendCode: string | null;
  shapeKey: string;
  title: string;
  category: string | null;
  name: string;
  status: 'active' | 'completed' | 'cancelled' | 'expired';
  creatorId: number;
  creatorName: string;
  startAt: string;
  endAt: string;
  daysLeft: number;
  visibility: string;
  gpsVisibility: string;
  areaLabel: string;
  startLabel: string;
  distanceKm: number;
  difficulty: string;
  progress: number;
  remainingKm: number;
  remainingPart: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  route: LatLng[];
  segments: (string | null)[];
  contributors: Contributor[];
  participants: number;
  joined: number;
  relays: number;
  myColor: string | null;
  members: { id: number; name: string; color: string }[];
}

export interface Artwork {
  id: number;
  name: string;
  crewName: string | null;
  isOurs: boolean;
  status: string;
  progress: number;
  endedAt: string;
  route: LatLng[];
  segments: (string | null)[];
}

export interface RunSummary {
  id: number;
  status: string;
  startedAt: string;
  endedAt: string | null;
  distanceKm: number;
  durationS: number;
  paceS: number | null;
  gapCount: number;
  gapSeconds: number;
  challenge: null | {
    id: number;
    title: string;
    shapeKey: string;
    shapeLabel: string;
    status: string;
    isFriend: boolean;
    progressBefore: number | null;
    progressAfter: number | null;
    currentProgress: number;
    remainingKm: number | null;
    segmentLabel: string | null;
    needsCategory: boolean;
  };
}

export interface RankRow {
  crewId: number;
  name: string;
  color: string;
  hasPhoto: boolean;
  members: number;
  level: number;
  mine: boolean;
  score: number;
  rank: number;
  tie: boolean;
  tier: string | null;
  detail: string;
  change?: number | 'NEW';
}

// ---------- 조회 ----------

export const useMe = () => {
  const token = useAuth((s) => s.accessToken);
  return useQuery({ queryKey: ['me', token], queryFn: () => api<Me>('/users/me'), enabled: !!token });
};
export const useMyCrews = () => {
  const token = useAuth((s) => s.accessToken);
  return useQuery({ queryKey: ['crews', token], queryFn: () => api<MyCrews>('/crews'), enabled: !!token });
};

/** 지금 보고 있는 크루 id(고른 크루 → 대표 크루 → 첫 크루) */
export function useCurrentCrewId(): number | null {
  const picked = useAuth((s) => s.crewId);
  const { data } = useMyCrews();
  if (!data) return null;
  if (picked && data.crews.some((c) => c.id === picked)) return picked;
  return data.primaryCrewId ?? data.crews[0]?.id ?? null;
}

export const useCrew = (id: number | null | undefined) =>
  useQuery({ queryKey: ['crew', id], queryFn: () => api<CrewDetail>(`/crews/${id}`), enabled: !!id });

export const useCurrentChallenge = (crewId: number | null) =>
  useQuery({
    queryKey: ['challenge', 'current', crewId],
    queryFn: () => api<Challenge | null>(`/crews/${crewId}/challenges/current`),
    enabled: !!crewId,
  });

export const useChallenge = (id: number | null | undefined) =>
  useQuery({ queryKey: ['challenge', id], queryFn: () => api<Challenge>(`/challenges/${id}`), enabled: !!id });

export const useArtworks = (scope: 'all' | 'crew' | 'mine', crewId?: number | null) =>
  useQuery({
    queryKey: ['artworks', scope, crewId],
    queryFn: () => api<Artwork[]>(`/artworks?scope=${scope}${crewId ? `&crewId=${crewId}` : ''}`),
  });

export const useRunsMonth = (month: string) =>
  useQuery({ queryKey: ['runs', month], queryFn: () => api<{ id: number; startedAt: string; durationS: number; distanceKm: number; isChallenge: boolean; title: string }[]>(`/runs?month=${month}`) });

export const useRun = (id: number | null | undefined) =>
  useQuery({ queryKey: ['run', id], queryFn: () => api<RunSummary & { points: LatLng[]; route: LatLng[] | null }>(`/runs/${id}`), enabled: !!id });

export const useRankings = (q: { type: 'completion_rate' | 'xp'; period: 'monthly' | 'all_time'; month?: string; category?: string }) =>
  useQuery({
    queryKey: ['rankings', q],
    queryFn: () =>
      api<{ rows: RankRow[]; updatedAt: string; total: number; periodKey: string }>(
        `/rankings?type=${q.type}&period=${q.period}${q.month ? `&month=${q.month}` : ''}${q.category ? `&category=${encodeURIComponent(q.category)}` : ''}`,
      ),
  });

export const useCollection = (crewId: number | null) =>
  useQuery({
    queryKey: ['collection', crewId],
    queryFn: () =>
      api<{ got: number; total: number; sets: { name: string; reward: string; got: number; total: number; items: { key: string; label: string; state: 'got' | 'half' | 'none' | 'locked' }[] }[] }>(
        `/crews/${crewId}/collection`,
      ),
    enabled: !!crewId,
  });

// ---------- 변경 ----------

/** 변경 후 관련 화면을 새로 불러오는 mutation */
export function useAction<V, R = any>(fn: (v: V) => Promise<R>, invalidate: unknown[][] = []) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => invalidate.forEach((k) => qc.invalidateQueries({ queryKey: k })),
  });
}

export const monthKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
