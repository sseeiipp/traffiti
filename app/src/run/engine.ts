import { Platform } from 'react-native';
import { api } from '../api/client';
import type { LatLng } from '../map/MapArt';
import { useRun, type GpsPoint, type RunSession } from '../store/run';

/** 웹이나 EXPO_PUBLIC_SIMULATE_GPS=true면 GPS 대신 경로를 따라 움직이는 가짜 위치를 쓴다(시연용) */
export const SIMULATE = Platform.OS === 'web' || process.env.EXPO_PUBLIC_SIMULATE_GPS === 'true';

export function haversine(a: LatLng, b: LatLng) {
  const R = 6_371_000;
  const r = (x: number) => (x * Math.PI) / 180;
  const h = Math.sin(r(b[0] - a[0]) / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(r(b[1] - a[1]) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** 30초 넘게 끊긴 곳은 거리에 넣지 않는다(서버와 같은 규칙) */
export function distanceOf(points: GpsPoint[]) {
  let d = 0;
  for (let i = 1; i < points.length; i++) {
    if (points[i].t - points[i - 1].t > 30_000) continue;
    d += haversine([points[i - 1].lat, points[i - 1].lng], [points[i].lat, points[i].lng]);
  }
  return d;
}

/** 서버가 시작한 러닝 id를 받아 둔다(오프라인이면 다음에 다시) */
export async function ensureRunId(s: RunSession): Promise<number | null> {
  if (s.runId) return s.runId;
  try {
    const r = await api<{ id: number }>('/runs', { body: { clientId: s.clientId, challengeId: s.challengeId, startedAt: s.startedAt } });
    useRun.getState().patch({ runId: r.id });
    return r.id;
  } catch {
    return null;
  }
}

/** 아직 안 올린 점을 올린다. 같은 seq는 서버가 무시해서 다시 보내도 안전하다 */
export async function uploadPending(): Promise<number> {
  const s = useRun.getState().session;
  if (!s) return 0;
  const id = await ensureRunId(s);
  if (!id) return s.points.length - s.uploaded - 1;
  const pending = s.points.filter((p) => p.seq > s.uploaded);
  for (let i = 0; i < pending.length; i += 200) {
    const batch = pending.slice(i, i + 200);
    try {
      await api(`/runs/${id}/points`, { body: { points: batch } });
      useRun.getState().patch({ uploaded: batch[batch.length - 1].seq });
    } catch {
      return pending.length - i;
    }
  }
  return 0;
}

/** 남은 점을 모두 올리고 러닝을 끝낸다. 성공하면 기기 기록을 지운다 */
export async function finishRun(): Promise<number> {
  const left = await uploadPending();
  const s = useRun.getState().session;
  if (!s?.runId || left > 0) throw new Error('연결되면 다시 저장할게요. 기록은 기기에 남아 있어요.');
  await api(`/runs/${s.runId}/finish`, { body: {} });
  const id = s.runId;
  useRun.getState().clear();
  return id;
}

/** 시연용 경로: 챌린지의 비어 있는 구간부터 따라간다 */
export function simulationPath(route: LatLng[] | undefined, segments: (string | null)[] | undefined, fallback: LatLng): LatLng[] {
  if (!route?.length) {
    // 개인 러닝: 출발 지점 주변을 크게 한 바퀴
    return Array.from({ length: 240 }, (_, i) => {
      const a = (i / 240) * Math.PI * 2;
      return [fallback[0] + 0.006 * Math.sin(a), fallback[1] + 0.008 * (1 - Math.cos(a))] as LatLng;
    });
  }
  const first = Math.max(0, segments?.findIndex((s) => !s) ?? 0);
  return route.slice(first);
}

/** 두 점 사이를 일정 간격(m)으로 나눈다 */
export function densify(path: LatLng[], step = 10): LatLng[] {
  const out: LatLng[] = [];
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    const n = Math.max(1, Math.round(haversine(a, b) / step));
    for (let k = 0; k < n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  }
  if (path.length) out.push(path[path.length - 1]);
  return out;
}
