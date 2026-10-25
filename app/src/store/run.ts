import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { storage } from './storage';

export interface GpsPoint {
  seq: number;
  lat: number;
  lng: number;
  t: number;
  accuracy: number | null;
}

/**
 * 진행 중인 러닝. 기록 중에는 기기에 먼저 저장하고(앱이 꺼져도 남는다),
 * 연결되면 서버로 올린다. uploaded는 서버가 받은 마지막 seq.
 */
export interface RunSession {
  clientId: string;
  runId: number | null;
  challengeId: number | null;
  startedAt: number;
  points: GpsPoint[];
  uploaded: number;
  paused: boolean;
  /** 일시정지로 빠진 시간(ms) */
  pausedMs: number;
  pausedAt: number | null;
  simulated: boolean;
  lastSavedAt: number;
}

interface RunState {
  session: RunSession | null;
  start: (s: Pick<RunSession, 'clientId' | 'challengeId' | 'simulated'>) => void;
  patch: (p: Partial<RunSession>) => void;
  addPoint: (p: Omit<GpsPoint, 'seq'>) => void;
  clear: () => void;
}

export const useRun = create<RunState>()(
  persist(
    (set, get) => ({
      session: null,
      start: (s) =>
        set({
          session: {
            ...s,
            runId: null,
            startedAt: Date.now(),
            points: [],
            uploaded: -1,
            paused: false,
            pausedMs: 0,
            pausedAt: null,
            lastSavedAt: Date.now(),
          },
        }),
      patch: (p) => {
        const cur = get().session;
        if (cur) set({ session: { ...cur, ...p } });
      },
      addPoint: (p) => {
        const cur = get().session;
        if (!cur || cur.paused) return;
        set({ session: { ...cur, points: [...cur.points, { ...p, seq: cur.points.length }], lastSavedAt: Date.now() } });
      },
      clear: () => set({ session: null }),
    }),
    { name: 'crew-run', storage },
  ),
);

export const newClientId = () => `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
