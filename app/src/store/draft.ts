import { create } from 'zustand';
import type { LatLng } from '../map/MapArt';

/** 새 챌린지 만들기(07 → 13) 동안 고른 값 */
export interface Draft {
  mode: 'library' | 'map' | 'sketch';
  shapeKey: string | null;
  /** 직접 그린 그림(M/L path) */
  customPath: string | null;
  start: LatLng;
  startLabel: string;
  areaLabel: string;
  km: number | null;
}

export const START_SPOTS: { label: string; area: string; pos: LatLng }[] = [
  { label: '성수역 3번 출구', area: '성수동 일대', pos: [37.5446, 127.0559] },
  { label: '서울숲역 4번 출구', area: '서울숲 일대', pos: [37.5436, 127.0446] },
  { label: '뚝섬역 1번 출구', area: '뚝섬 일대', pos: [37.5474, 127.0474] },
  { label: '왕십리역 6번 출구', area: '왕십리 일대', pos: [37.5612, 127.0371] },
];

const initial: Draft = {
  mode: 'library',
  shapeKey: 'whale',
  customPath: null,
  start: START_SPOTS[0].pos,
  startLabel: START_SPOTS[0].label,
  areaLabel: START_SPOTS[0].area,
  km: null,
};

export const useDraft = create<Draft & { set: (p: Partial<Draft>) => void; reset: () => void }>()((set) => ({
  ...initial,
  set: (p) => set(p),
  reset: () => set(initial),
}));
