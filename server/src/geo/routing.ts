import { haversine, pathLength, projectShape, resample, type LatLng } from './geometry.js';
import { insideRoads, roadCoverage, roads, toLL, toXY, traceOnRoads } from './roads.js';

/** OSRM 도보 경로 서버. 기본은 공개 서버(FOSSGIS), 자체 호스팅하면 OSRM_URL로 바꾼다. */
const OSRM_URL = process.env.OSRM_URL ?? 'https://routing.openstreetmap.de/routed-foot/route/v1/foot';

/**
 * 그림 선을 경유점으로 나눠 보행 도로를 따라 이어 붙인다.
 * 서버가 응답하지 않거나 길을 못 찾으면 null(호출하는 쪽이 그림 선을 그대로 쓴다).
 */
export async function snapToRoads(line: LatLng[]): Promise<LatLng[] | null> {
  // 경유점이 너무 촘촘하면 도로 밖 점마다 되돌이가 생겨서 120m 이상 띄운다
  const wps = resample(line, Math.max(120, pathLength(line) / 60));
  const coords = wps.map(([lat, lng]) => `${lng.toFixed(6)},${lat.toFixed(6)}`).join(';');
  try {
    const res = await fetch(`${OSRM_URL}/${coords}?overview=full&geometries=geojson`, {
      signal: AbortSignal.timeout(8_000),
      headers: { 'user-agent': 'travity/1.0' },
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { code: string; routes?: { geometry: { coordinates: [number, number][] } }[] };
    const pts = j.code === 'Ok' ? j.routes?.[0]?.geometry.coordinates : undefined;
    return pts && pts.length > 1 ? despur(pts.map(([lng, lat]) => [lat, lng] as LatLng)) : null;
  } catch {
    return null;
  }
}

/** 경유점이 도로 밖에 있을 때 생기는 '갔다가 같은 길로 돌아오는' 짧은 구간과 작은 고리를 잘라낸다 */
export function despur(pts: LatLng[], near = 12, maxLoop = 200): LatLng[] {
  const out: LatLng[] = [];
  const acc: number[] = [];
  for (const q of resample(pts, 5)) {
    const d = out.length ? acc[acc.length - 1] + haversine(out[out.length - 1], q) : 0;
    let cut = -1;
    for (let k = out.length - 3; k >= 0 && d - acc[k] <= maxLoop; k--) if (haversine(out[k], q) <= near) cut = k;
    if (cut >= 0) {
      out.length = acc.length = cut + 1;
      continue;
    }
    out.push(q);
    acc.push(d);
  }
  return out;
}

/**
 * 그림과 닮은 정도(0~100). 그림 선의 점이 경로에서 tol 안에 있는 비율과
 * 경로의 점이 그림 선에서 tol 안에 있는 비율의 평균. 둘 다 같은 간격으로 다시 나눈 뒤 잰다.
 */
export function similarity(shape: LatLng[], route: LatLng[], tol = 40): number {
  const a = resample(shape, 20);
  const b = resample(route, 20);
  const near = (p: LatLng, set: LatLng[]) => set.some((q) => haversine(p, q) <= tol);
  const ab = a.filter((p) => near(p, b)).length / a.length;
  const ba = b.filter((p) => near(p, a)).length / b.length;
  return Math.round(((ab + ba) / 2) * 100);
}

export interface FittedRoute {
  /** 그림을 옮겨 놓은 선 */
  shape: LatLng[];
  /** 도로를 따라 붙인 경로. 경로 서버에 닿지 않으면 null */
  road: LatLng[] | null;
  similarity: number | null;
  /** 출발 지점을 옮긴 거리(m) */
  movedM: number;
  /** 그림을 돌린 각도(도, 시계 방향이 +) */
  rotatedDeg?: number;
}

// ---- 도로망을 가지고 있을 때: 자리·각도·크기를 고르고 그림 선에 붙은 길로 잇는다 ----

const SHIFTS = [0, -250, 250, -500, 500, -800];
const ROTATIONS = [0, -10, 10, -20, 20, -30, 30];
const SCALES = [1, 0.9, 1.1];

function placeShape(path: string, start: LatLng, meters: number, dn: number, de: number, rot: number, scale: number): LatLng[] {
  const [sx, sy] = toXY(start);
  const base = projectShape(path, toLL([sx + de, sy + dn]), meters * scale).map(toXY);
  const [ox, oy] = base[0];
  const r = (-rot * Math.PI) / 180;
  const c = Math.cos(r), s = Math.sin(r);
  return base.map(([x, y]) => toLL([ox + (x - ox) * c - (y - oy) * s, oy + (x - ox) * s + (y - oy) * c]));
}

/** 경로 처음·끝이 그림에서 80m 넘게 벗어난 꼬리(첫 경유점이 엉뚱한 길에 붙은 경우)를 잘라낸다 */
function trimEnds(road: LatLng[], shape: LatLng[], tol = 80): LatLng[] {
  const pts = resample(shape, 20);
  const near = (p: LatLng) => pts.some((q) => haversine(p, q) <= tol);
  let a = 0, b = road.length - 1;
  while (a < b && !near(road[a])) a++;
  while (b > a && !near(road[b])) b--;
  return b - a >= 2 ? road.slice(a, b + 1) : road;
}

function fitWithRoads(path: string, start: LatLng, meters: number): FittedRoute | null {
  const g = roads();
  if (!g) return null;
  const cands: { dn: number; de: number; rot: number; scale: number; score: number; shape: LatLng[] }[] = [];
  for (const dn of SHIFTS)
    for (const de of SHIFTS)
      for (const rot of ROTATIONS)
        for (const scale of SCALES) {
          const shape = placeShape(path, start, meters, dn, de, rot, scale);
          const pts = resample(shape, 20).map(toXY);
          if (!insideRoads(g, pts)) continue;
          // 길이 있는 곳을 많이 지나는 자리를 고르되, 출발 지점·모양을 많이 바꿀수록 조금씩 깎는다
          const score = roadCoverage(g, pts) - Math.hypot(dn, de) / 8000 - Math.abs(rot) / 600 - Math.abs(scale - 1) / 4;
          cands.push({ dn, de, rot, scale, score, shape });
        }
  if (!cands.length) return null;
  cands.sort((a, b) => b.score - a.score);
  let best: (FittedRoute & { score: number }) | null = null;
  for (const c of cands.slice(0, 12)) {
    const traced = traceOnRoads(g, c.shape);
    if (!traced) continue;
    // 막다른 길에 붙은 경유점은 수백 m를 들어갔다 나오므로 더 긴 되돌이까지 잘라낸다
    const road = trimEnds(despur(traced, 12, 600), c.shape);
    const sim = similarity(c.shape, road);
    const ratio = pathLength(road) / pathLength(c.shape);
    const score = sim - 30 * Math.max(0, ratio - 1.3) - Math.hypot(c.dn, c.de) / 200;
    if (!best || score > best.score) best = { shape: c.shape, road, similarity: sim, movedM: Math.round(Math.hypot(c.dn, c.de)), rotatedDeg: c.rot, score };
  }
  if (!best) return null;
  const { score: _score, ...r } = best;
  return r;
}

/** 강·하천을 가로지르면 다리까지 크게 돌아가므로, 출발 지점을 조금씩 옮겨 가며 가장 잘 맞는 자리를 고른다(m, 북·동) */
const OFFSETS: [number, number][] = [
  [0, 0],
  [-400, 0],
  [-800, -500],
  [0, -500],
  [-800, 0],
];
const cache = new Map<string, FittedRoute>();

export async function fitToRoads(path: string, start: LatLng, meters: number): Promise<FittedRoute> {
  const key = `${path}|${start.join()}|${Math.round(meters)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const local = fitWithRoads(path, start, meters);
  if (local) {
    cache.set(key, local);
    return local;
  }
  // 도로망 밖이면 공개 경로 서버(OSRM)에 경유점을 넘긴다
  const cosLat = Math.cos((start[0] * Math.PI) / 180);
  let best: (FittedRoute & { score: number }) | null = null;
  for (const [dn, de] of OFFSETS) {
    const st: LatLng = [start[0] + dn / 111_320, start[1] + de / (111_320 * cosLat)];
    const shape = projectShape(path, st, meters);
    const road = await snapToRoads(shape);
    if (!road) {
      // 경로 서버에 닿지 않으면 더 시도하지 않는다
      if (!best) return { shape: projectShape(path, start, meters), road: null, similarity: null, movedM: 0 };
      break;
    }
    const sim = similarity(shape, road);
    const ratio = pathLength(road) / pathLength(shape);
    const score = sim - 30 * Math.max(0, ratio - 1.3);
    if (!best || score > best.score) best = { shape, road, similarity: sim, movedM: Math.round(Math.hypot(dn, de)), score };
    if (sim >= 72 && ratio <= 1.45) break;
  }
  const { score: _score, ...r } = best!;
  cache.set(key, r);
  return r;
}
