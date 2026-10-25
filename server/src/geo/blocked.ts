import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import type { LatLng } from './geometry.js';
import { toXY } from './roads.js';

/**
 * 걸어서 다니면 안 되는 길(자동차 전용·고속도로·보행 금지·보도 없는 큰 길, data/blocked.json.gz).
 * scripts/build-blocked.mjs로 만든다. 앱 지도에 빨간 실선으로 그리고, 경로 찾기에서는 이 길을 따라 걷지 않게 한다.
 */
export interface BlockedLine {
  pts: LatLng[];
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

const CELL = 10; // '이 칸에 못 가는 길이 지나간다' 표시용 칸(m)
const cellKey = (cx: number, cy: number) => (cx + 50_000) * 100_000 + (cy + 50_000);

let cache: { lines: BlockedLine[]; cells: Set<number> } | null | undefined;

function load() {
  if (cache !== undefined) return cache;
  const file = [join(process.cwd(), 'data', 'blocked.json.gz'), join(process.cwd(), 'server', 'data', 'blocked.json.gz')].find(existsSync);
  if (!file) return (cache = null);
  const raw = JSON.parse(gunzipSync(readFileSync(file)).toString()) as number[][];
  const lines: BlockedLine[] = [];
  const cells = new Set<number>();
  for (const flat of raw) {
    const pts: LatLng[] = [];
    for (let i = 0; i + 1 < flat.length; i += 2) pts.push([flat[i] / 1e5, flat[i + 1] / 1e5]);
    if (pts.length < 2) continue;
    const lats = pts.map((p) => p[0]);
    const lngs = pts.map((p) => p[1]);
    lines.push({ pts, minLat: Math.min(...lats), maxLat: Math.max(...lats), minLng: Math.min(...lngs), maxLng: Math.max(...lngs) });
    // 선을 5m 간격으로 찍어 칸을 표시한다
    for (let k = 1; k < pts.length; k++) {
      const [ax, ay] = toXY(pts[k - 1]);
      const [bx, by] = toXY(pts[k]);
      const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 5));
      for (let s = 0; s <= steps; s++) {
        const x = ax + ((bx - ax) * s) / steps, y = ay + ((by - ay) * s) / steps;
        cells.add(cellKey(Math.floor(x / CELL), Math.floor(y / CELL)));
      }
    }
  }
  return (cache = { lines, cells });
}

/** 범위(남·서·북·동) 안을 지나는 못 가는 길. 범위가 없으면 전부 */
export function blockedLines(bbox?: { minLat: number; minLng: number; maxLat: number; maxLng: number }): LatLng[][] {
  const c = load();
  if (!c) return [];
  return c.lines
    .filter((l) => !bbox || (l.maxLat >= bbox.minLat && l.minLat <= bbox.maxLat && l.maxLng >= bbox.minLng && l.minLng <= bbox.maxLng))
    .map((l) => l.pts);
}

/** 평면 좌표(m, roads.ts의 toXY)가 못 가는 길 위(±10m)인지 */
export function onBlockedXY(x: number, y: number): boolean {
  const c = load();
  if (!c) return false;
  return c.cells.has(cellKey(Math.floor(x / CELL), Math.floor(y / CELL)));
}

/** 경로가 못 가는 길을 따라가는 곳(20m 넘게 이어진 부분)들. 앱이 경로 위에 빨갛게 덧그린다 */
export function blockedStretches(route: LatLng[], minM = 20): LatLng[][] {
  const out: LatLng[][] = [];
  let cur: LatLng[] = [];
  const flush = () => {
    if (cur.length > 1) {
      let m = 0;
      for (let i = 1; i < cur.length; i++) {
        const [ax, ay] = toXY(cur[i - 1]);
        const [bx, by] = toXY(cur[i]);
        m += Math.hypot(bx - ax, by - ay);
      }
      if (m >= minM) out.push(cur);
    }
    cur = [];
  };
  for (const p of route) {
    const [x, y] = toXY(p);
    if (onBlockedXY(x, y)) cur.push(p);
    else flush();
  }
  flush();
  return out;
}
