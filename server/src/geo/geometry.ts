export type Pt = [number, number]; // [x, y] in shape units
export type LatLng = [number, number]; // [lat, lng]

const EARTH_M_PER_DEG = 111_320;

/** 절대 좌표 M/L/C/Z만 쓰는 SVG path를 폴리라인 목록(서브패스별)으로 펼친다. */
export function flattenPath(d: string, curveSteps = 12): Pt[][] {
  const tokens = d.match(/[MLCZ]|-?\d*\.?\d+/gi) ?? [];
  const out: Pt[][] = [];
  let cur: Pt[] = [];
  let i = 0;
  let cmd = '';
  const num = () => Number(tokens[i++]);
  while (i < tokens.length) {
    if (/[MLCZ]/i.test(tokens[i])) cmd = tokens[i++].toUpperCase();
    if (cmd === 'M') {
      if (cur.length) out.push(cur);
      cur = [[num(), num()]];
      cmd = 'L';
    } else if (cmd === 'L') {
      cur.push([num(), num()]);
    } else if (cmd === 'C') {
      const p0 = cur[cur.length - 1];
      const p1: Pt = [num(), num()];
      const p2: Pt = [num(), num()];
      const p3: Pt = [num(), num()];
      for (let s = 1; s <= curveSteps; s++) {
        const t = s / curveSteps;
        const mt = 1 - t;
        cur.push([
          mt * mt * mt * p0[0] + 3 * mt * mt * t * p1[0] + 3 * mt * t * t * p2[0] + t * t * t * p3[0],
          mt * mt * mt * p0[1] + 3 * mt * mt * t * p1[1] + 3 * mt * t * t * p2[1] + t * t * t * p3[1],
        ]);
      }
    } else if (cmd === 'Z') {
      if (cur.length) cur.push(cur[0]);
      cmd = '';
    } else {
      i++;
    }
  }
  if (cur.length) out.push(cur);
  return out;
}

const planarLen = (pts: Pt[]) => pts.slice(1).reduce((s, p, k) => s + Math.hypot(p[0] - pts[k][0], p[1] - pts[k][1]), 0);

export function haversine(a: LatLng, b: LatLng): number {
  const R = 6_371_000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const pathLength = (pts: LatLng[]) => pts.slice(1).reduce((s, p, k) => s + haversine(pts[k], p), 0);

/**
 * 그림을 출발 지점에 맞춰 실제 좌표로 옮긴다. 첫 점이 출발 지점이 되고,
 * 전체 선 길이가 targetMeters가 되도록 크기를 맞춘다.
 */
export function projectShape(d: string, start: LatLng, targetMeters: number): LatLng[] {
  const subpaths = flattenPath(d);
  const total = subpaths.reduce((s, p) => s + planarLen(p), 0);
  const scale = targetMeters / total; // meters per shape unit
  const [x0, y0] = subpaths[0][0];
  const cosLat = Math.cos((start[0] * Math.PI) / 180);
  const line: LatLng[] = [];
  for (const sp of subpaths) {
    for (const [x, y] of sp) {
      line.push([start[0] - ((y - y0) * scale) / EARTH_M_PER_DEG, start[1] + ((x - x0) * scale) / (EARTH_M_PER_DEG * cosLat)]);
    }
  }
  return line;
}

/** 선을 같은 길이(stepMeters)의 구간으로 나눈 꼭짓점 목록. 구간 i = [pts[i], pts[i+1]] */
export function resample(line: LatLng[], stepMeters: number): LatLng[] {
  const out: LatLng[] = [line[0]];
  let carry = 0;
  for (let k = 1; k < line.length; k++) {
    const a = line[k - 1];
    const b = line[k];
    const seg = haversine(a, b);
    let pos = stepMeters - carry;
    while (pos <= seg) {
      const t = pos / seg;
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      pos += stepMeters;
    }
    carry = seg - (pos - stepMeters);
  }
  const last = line[line.length - 1];
  if (haversine(out[out.length - 1], last) > stepMeters * 0.25) out.push(last);
  return out;
}

export interface RunPoint {
  lat: number;
  lng: number;
  t: number; // epoch ms
  accuracy?: number | null;
}

export const GPS_GAP_MS = 30_000;
export const MAX_ACCURACY_M = 50;
/** 목표 구간 중심에서 이 거리 안에 기록 점이 있으면 그 구간을 채운 것으로 본다. */
export const COVER_TOLERANCE_M = 30;
/** 이 비율 이상 채우면 작품 완성 */
export const COMPLETE_RATIO = 0.95;

export interface RunStats {
  distanceM: number;
  durationS: number;
  gapCount: number;
  gapSeconds: number;
  validPoints: RunPoint[];
}

/**
 * GPS 기록을 정리한다. 정확도가 나쁜 점은 버리고, 30초 넘게 끊긴 곳은
 * 거리에 넣지 않고 공백으로 센다(직선으로 잇지 않는다).
 */
export function analyzeRun(points: RunPoint[]): RunStats {
  const sorted = [...points].sort((a, b) => a.t - b.t);
  const valid = sorted.filter((p) => p.accuracy == null || p.accuracy <= MAX_ACCURACY_M);
  let distanceM = 0;
  let gapCount = 0;
  let gapMs = 0;
  for (let k = 1; k < valid.length; k++) {
    const dt = valid[k].t - valid[k - 1].t;
    const dist = haversine([valid[k - 1].lat, valid[k - 1].lng], [valid[k].lat, valid[k].lng]);
    if (dt > GPS_GAP_MS) {
      gapCount++;
      gapMs += dt;
      continue;
    }
    // 시속 30km를 넘는 이동은 GPS 튐으로 보고 빼낸다
    if (dt > 0 && dist / (dt / 1000) > 8.4) continue;
    distanceM += dist;
  }
  const durationS = valid.length > 1 ? Math.round((valid[valid.length - 1].t - valid[0].t - gapMs) / 1000) : 0;
  return { distanceM, durationS, gapCount, gapSeconds: Math.round(gapMs / 1000), validPoints: valid };
}

/** 기록 점이 채운 목표 구간 번호 */
export function coveredSegments(route: LatLng[], points: RunPoint[]): number[] {
  const hit: number[] = [];
  for (let i = 0; i < route.length - 1; i++) {
    const mid: LatLng = [(route[i][0] + route[i + 1][0]) / 2, (route[i][1] + route[i + 1][1]) / 2];
    if (points.some((p) => haversine(mid, [p.lat, p.lng]) <= COVER_TOLERANCE_M)) hit.push(i);
  }
  return hit;
}
