import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { resample, type LatLng } from './geometry.js';

/**
 * 지원 지역의 걸을 수 있는 길(data/roads.bin.gz, scripts/build-roads.mjs로 만든다).
 * 경로 서버에 경유점만 넘기면 가까운 아무 길로나 이어서 그림이 뭉개지므로,
 * 이 도로망 위에서 '그림 선에서 멀어질수록 비싼' 비용으로 직접 길을 찾는다.
 * 좌표는 기준점에서 동(x)·북(y) 방향 미터로 바꿔서 다룬다.
 */
const ORIGIN: LatLng = [37.55, 127.05];
const M_PER_DEG = 111_320;
const COS0 = Math.cos((ORIGIN[0] * Math.PI) / 180);
export const toXY = ([lat, lng]: LatLng): [number, number] => [(lng - ORIGIN[1]) * M_PER_DEG * COS0, (lat - ORIGIN[0]) * M_PER_DEG];
export const toLL = ([x, y]: [number, number]): LatLng => [ORIGIN[0] + y / M_PER_DEG, ORIGIN[1] + x / (M_PER_DEG * COS0)];

const NODE_CELL = 50; // 가장 가까운 교차점 찾기용 칸(m)
const ROAD_CELL = 20; // '이 근처에 길이 있나' 표시용 칸(m)
const cellKey = (cx: number, cy: number) => (cx + 50_000) * 100_000 + (cy + 50_000);

interface Graph {
  x: Float64Array;
  y: Float64Array;
  /** 노드 i의 이웃은 nbr[start[i] .. start[i+1]) */
  start: Uint32Array;
  nbr: Uint32Array;
  len: Float32Array;
  nodeGrid: Map<number, number[]>;
  roadCells: Set<number>;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

let graph: Graph | null | undefined;

/** 도로망을 한 번만 읽는다. 파일이 없으면 null(경로 서버 방식으로 돌아간다) */
export function roads(): Graph | null {
  if (graph !== undefined) return graph;
  const file = [join(process.cwd(), 'data', 'roads.bin.gz'), join(process.cwd(), 'server', 'data', 'roads.bin.gz')].find(existsSync);
  if (!file) return (graph = null);
  const buf = gunzipSync(readFileSync(file));
  const N = buf.readUInt32LE(0);
  const E = buf.readUInt32LE(4);
  const lat = new Int32Array(buf.buffer.slice(buf.byteOffset + 8, buf.byteOffset + 8 + N * 4));
  const lng = new Int32Array(buf.buffer.slice(buf.byteOffset + 8 + N * 4, buf.byteOffset + 8 + N * 8));
  const ed = new Uint32Array(buf.buffer.slice(buf.byteOffset + 8 + N * 8, buf.byteOffset + 8 + N * 8 + E * 8));
  const x = new Float64Array(N);
  const y = new Float64Array(N);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < N; i++) {
    [x[i], y[i]] = toXY([lat[i] / 1e6, lng[i] / 1e6]);
    minX = Math.min(minX, x[i]); maxX = Math.max(maxX, x[i]);
    minY = Math.min(minY, y[i]); maxY = Math.max(maxY, y[i]);
  }
  const deg = new Uint32Array(N + 1);
  for (let e = 0; e < E; e++) (deg[ed[2 * e]]++, deg[ed[2 * e + 1]]++);
  const start = new Uint32Array(N + 1);
  for (let i = 0; i < N; i++) start[i + 1] = start[i] + deg[i];
  const fill = start.slice(0, N);
  const nbr = new Uint32Array(2 * E);
  const len = new Float32Array(2 * E);
  const nodeGrid = new Map<number, number[]>();
  const roadCells = new Set<number>();
  const used = new Uint8Array(N);
  for (let e = 0; e < E; e++) {
    const a = ed[2 * e], b = ed[2 * e + 1];
    const d = Math.hypot(x[a] - x[b], y[a] - y[b]);
    (nbr[fill[a]] = b), (len[fill[a]++] = d);
    (nbr[fill[b]] = a), (len[fill[b]++] = d);
    used[a] = used[b] = 1;
    // 간선을 10m 간격으로 찍어 '길 있는 칸'을 표시한다
    const steps = Math.max(1, Math.ceil(d / 10));
    for (let s = 0; s <= steps; s++) {
      const px = x[a] + ((x[b] - x[a]) * s) / steps, py = y[a] + ((y[b] - y[a]) * s) / steps;
      roadCells.add(cellKey(Math.floor(px / ROAD_CELL), Math.floor(py / ROAD_CELL)));
    }
  }
  for (let i = 0; i < N; i++) {
    if (!used[i]) continue;
    const k = cellKey(Math.floor(x[i] / NODE_CELL), Math.floor(y[i] / NODE_CELL));
    const list = nodeGrid.get(k);
    if (list) list.push(i);
    else nodeGrid.set(k, [i]);
  }
  return (graph = { x, y, start, nbr, len, nodeGrid, roadCells, minX, maxX, minY, maxY });
}

/** 그림이 도로망 범위 안에 다 들어오는지 */
export function insideRoads(g: Graph, pts: [number, number][]) {
  return pts.every(([px, py]) => px > g.minX + 100 && px < g.maxX - 100 && py > g.minY + 100 && py < g.maxY - 100);
}

/** (x, y)에서 maxD 안의 가장 가까운 교차점·길 위 점. 없으면 -1 */
export function nearestNode(g: Graph, px: number, py: number, maxD: number): number {
  const r = Math.ceil(maxD / NODE_CELL);
  const cx = Math.floor(px / NODE_CELL), cy = Math.floor(py / NODE_CELL);
  let best = -1, bd = maxD;
  for (let i = -r; i <= r; i++)
    for (let j = -r; j <= r; j++)
      for (const n of g.nodeGrid.get(cellKey(cx + i, cy + j)) ?? []) {
        const d = Math.hypot(g.x[n] - px, g.y[n] - py);
        if (d < bd) (bd = d), (best = n);
      }
  return best;
}

/** 그림 점들 중 30m 안에 길이 있는 비율(0~1). 자리·각도 후보를 빠르게 비교할 때 쓴다 */
export function roadCoverage(g: Graph, pts: [number, number][]): number {
  let hit = 0;
  for (const [px, py] of pts) {
    const cx = Math.floor(px / ROAD_CELL), cy = Math.floor(py / ROAD_CELL);
    let ok = false;
    for (let i = -1; i <= 1 && !ok; i++) for (let j = -1; j <= 1 && !ok; j++) ok = g.roadCells.has(cellKey(cx + i, cy + j));
    if (ok) hit++;
  }
  return hit / pts.length;
}

/** 그림 선까지의 거리 지도(10m 칸, 최대 CAP m). 길 찾기 비용에 쓴다 */
const FIELD_CELL = 10;
const CAP = 150;
function distanceField(shape: [number, number][]) {
  const xs = shape.map((p) => p[0]), ys = shape.map((p) => p[1]);
  const x0 = Math.min(...xs) - CAP - 400, y0 = Math.min(...ys) - CAP - 400;
  const w = Math.ceil((Math.max(...xs) + CAP + 400 - x0) / FIELD_CELL);
  const h = Math.ceil((Math.max(...ys) + CAP + 400 - y0) / FIELD_CELL);
  const f = new Float32Array(w * h).fill(CAP);
  const r = Math.ceil(CAP / FIELD_CELL);
  for (const [px, py] of shape) {
    const cx = Math.floor((px - x0) / FIELD_CELL), cy = Math.floor((py - y0) / FIELD_CELL);
    for (let i = Math.max(0, cx - r); i <= Math.min(w - 1, cx + r); i++)
      for (let j = Math.max(0, cy - r); j <= Math.min(h - 1, cy + r); j++) {
        const d = Math.hypot(x0 + (i + 0.5) * FIELD_CELL - px, y0 + (j + 0.5) * FIELD_CELL - py);
        if (d < f[j * w + i]) f[j * w + i] = d;
      }
  }
  return (px: number, py: number) => {
    const i = Math.floor((px - x0) / FIELD_CELL), j = Math.floor((py - y0) / FIELD_CELL);
    return i < 0 || j < 0 || i >= w || j >= h ? CAP : f[j * w + i];
  };
}

/** 작은 이진 힙(우선순위 큐) */
class Heap {
  private k: number[] = [];
  private v: number[] = [];
  get size() {
    return this.k.length;
  }
  push(key: number, val: number) {
    const { k, v } = this;
    let i = k.length;
    k.push(key), v.push(val);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (k[p] <= key) break;
      (k[i] = k[p]), (v[i] = v[p]), (i = p);
    }
    (k[i] = key), (v[i] = val);
  }
  pop(): number {
    const { k, v } = this;
    const top = v[0];
    const lk = k.pop()!, lv = v.pop()!;
    if (k.length) {
      let i = 0;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= k.length) break;
        if (c + 1 < k.length && k[c + 1] < k[c]) c++;
        if (k[c] >= lk) break;
        (k[i] = k[c]), (v[i] = v[c]), (i = c);
      }
      (k[i] = lk), (v[i] = lv);
    }
    return top;
  }
}

/**
 * 그림 선을 따라 도로 위 경로를 만든다. 경유점(약 120m 간격)을 가장 가까운 길에 붙이고,
 * 경유점 사이는 '길이 × (1 + (그림 선까지 거리/30m)²)' 비용이 가장 작은 길로 잇는다.
 * 그래서 그림에서 멀리 돌아가는 길보다 그림 선에 붙은 길을 고른다. 못 이으면 null.
 */
export function traceOnRoads(g: Graph, shapeLL: LatLng[]): LatLng[] | null {
  const shape = resample(shapeLL, 10).map(toXY);
  const dist = distanceField(shape);
  const wps: number[] = [];
  for (const p of resample(shapeLL, 120).map(toXY)) {
    // 경유점을 건너뛰면 그 부분을 질러가 버리므로, 길이 멀어도 150m 안이면 들른다
    const n = nearestNode(g, p[0], p[1], 150);
    if (n >= 0 && n !== wps[wps.length - 1]) wps.push(n);
  }
  if (wps.length < 3) return null;
  const cost = new Map<number, number>();
  const prev = new Map<number, number>();
  const done = new Set<number>();
  const path: number[] = [wps[0]];
  for (let s = 1; s < wps.length; s++) {
    const from = path[path.length - 1], to = wps[s];
    if (from === to) continue;
    cost.clear(), prev.clear(), done.clear();
    const heap = new Heap();
    cost.set(from, 0);
    heap.push(0, from);
    let found = false;
    for (let expanded = 0; heap.size && expanded < 30_000; ) {
      const u = heap.pop();
      if (done.has(u)) continue;
      done.add(u);
      expanded++;
      if (u === to) {
        found = true;
        break;
      }
      const cu = cost.get(u)!;
      for (let e = g.start[u]; e < g.start[u + 1]; e++) {
        const w = g.nbr[e];
        // 긴 길은 가운데만 보면 끝이 그림에서 멀어도 싸 보여서 양 끝과 가운데를 평균 낸다
        const d = (dist(g.x[u], g.y[u]) + dist((g.x[u] + g.x[w]) / 2, (g.y[u] + g.y[w]) / 2) + dist(g.x[w], g.y[w])) / 3;
        const c = cu + g.len[e] * (1 + (d / 20) ** 2);
        if (c < (cost.get(w) ?? Infinity)) {
          cost.set(w, c);
          prev.set(w, u);
          heap.push(c + Math.hypot(g.x[w] - g.x[to], g.y[w] - g.y[to]), w);
        }
      }
    }
    if (!found) continue; // 이어지지 않는 경유점은 건너뛴다
    const leg: number[] = [];
    for (let n = to; n !== from; n = prev.get(n)!) leg.push(n);
    path.push(...leg.reverse());
  }
  if (path.length < 3) return null;
  return path.map((n) => toLL([g.x[n], g.y[n]]));
}
