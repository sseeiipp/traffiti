import { useMemo } from 'react';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import { C } from '../theme';
import { KAKAO_JS_KEY, KakaoRouteMap } from './KakaoMap';
import { SHAPE_ICONS } from './shapes';

export type LatLng = [number, number];

/**
 * 지도 바탕. 지도 SDK가 정해지기 전까지 디자인의 단순화된 동네 지도(땅·공원·물·도로)를 그린다.
 * seed로 도로 배치를 조금씩 바꾼다.
 */
export function MapBackdrop({ w, h, seed = 0, water = true }: { w: number; h: number; seed?: number; water?: boolean }) {
  const s = (n: number) => ((n * 9301 + seed * 49297) % 233280) / 233280;
  const majorH = [0.12 + s(1) * 0.08, 0.62 + s(2) * 0.1];
  const majorV = [0.28 + s(3) * 0.06, 0.74 + s(4) * 0.04];
  const minorH = [0.32, 0.45, 0.82];
  const minorV = [0.08, 0.5, 0.58, 0.92];
  return (
    <G>
      <Rect width={w} height={h} fill={C.map.land} />
      <Rect x={w * 0.67} y={h * 0.07} width={w * 0.28} height={h * 0.22} rx={6} fill={C.map.park} />
      {water ? (
        <Path
          d={`M-10 ${h * 0.86} C${w * 0.23} ${h * 0.78} ${w * 0.44} ${h * 0.98} ${w * 0.7} ${h * 0.9} C${w * 0.85} ${h * 0.85} ${w * 0.95} ${h * 0.79} ${w + 10} ${h * 0.81} L${w + 10} ${h} L-10 ${h} Z`}
          fill={C.map.water}
        />
      ) : null}
      <G stroke={C.map.minor} strokeWidth={2.5} fill="none">
        {minorH.map((y) => (
          <Path key={`h${y}`} d={`M0 ${h * y} L${w} ${h * y - h * 0.045}`} />
        ))}
        {minorV.map((x) => (
          <Path key={`v${x}`} d={`M${w * x} 0 L${w * x - w * 0.02} ${h}`} />
        ))}
      </G>
      <G stroke={C.map.road} strokeWidth={7} fill="none" strokeLinecap="round">
        {majorH.map((y) => (
          <Path key={`H${y}`} d={`M0 ${h * y} L${w} ${h * y - h * 0.055}`} />
        ))}
        {majorV.map((x) => (
          <Path key={`V${x}`} d={`M${w * x} 0 L${w * x - w * 0.04} ${h}`} />
        ))}
      </G>
    </G>
  );
}

function project(route: LatLng[], w: number, h: number, pad: number) {
  const lat0 = route[0]?.[0] ?? 37.5;
  const k = Math.cos((lat0 * Math.PI) / 180);
  const xs = route.map((p) => p[1] * k);
  const ys = route.map((p) => -p[0]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const scale = Math.min((w - pad * 2) / (maxX - minX || 1), (h - pad * 2) / (maxY - minY || 1));
  const ox = (w - (maxX - minX) * scale) / 2;
  const oy = (h - (maxY - minY) * scale) / 2;
  const f = (p: LatLng): [number, number] => [ox + (p[1] * k - minX) * scale, oy + (-p[0] - minY) * scale];
  return f;
}

const toD = (pts: [number, number][]) => pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');

export interface RouteArtProps {
  route: LatLng[];
  /** 구간별 색. null이면 아직 아무도 달리지 않은 곳 */
  segments?: (string | null)[];
  w: number;
  h: number;
  pad?: number;
  /** progress: 사람 색 + 남은 구간 점선 / route: 검은 제안 경로 / target: 빨간 점선 그림 */
  mode?: 'progress' | 'route' | 'target' | 'faded';
  stroke?: number;
  map?: boolean;
  bg?: string;
  seed?: number;
  /** 현재 위치(내 색 점) */
  me?: { pos: LatLng; color: string } | null;
  /** 이번 러닝 경로 */
  trail?: { points: LatLng[]; color: string } | null;
  showStart?: boolean;
  /** 남은 구간 점선 숨기기(공유 이미지) */
  hideRemaining?: boolean;
  /** 지도가 화면을 꽉 채울 때 위·아래에 떠 있는 요소 높이. 경로를 그 사이에 맞춘다(카카오맵만) */
  insetTop?: number;
  insetBottom?: number;
}

/** 지도 바탕이 필요하면 카카오맵, 키가 없거나 불러오지 못하면 단순화한 SVG 지도 */
export function RouteArt(props: RouteArtProps) {
  const svg = <SvgRouteArt {...props} />;
  if (props.map === false || !KAKAO_JS_KEY || !props.route.length) return svg;
  return <KakaoRouteMap {...props} fallback={svg} />;
}

function SvgRouteArt({
  route,
  segments,
  w,
  h,
  pad = 24,
  mode = 'progress',
  stroke = 6,
  map = true,
  bg,
  seed,
  me,
  trail,
  showStart,
  hideRemaining,
}: RouteArtProps) {
  const groups = useMemo(() => {
    if (!route.length) return { f: null, runs: [] as { color: string | null; pts: [number, number][] }[] };
    const f = project(trail ? [...route, ...trail.points] : route, w, h, pad);
    const segs = segments ?? route.slice(1).map(() => null);
    const runs: { color: string | null; pts: [number, number][] }[] = [];
    segs.forEach((c, i) => {
      const last = runs[runs.length - 1];
      const a = f(route[i]);
      const b = f(route[i + 1]);
      if (last && last.color === c) last.pts.push(b);
      else runs.push({ color: c, pts: [a, b] });
    });
    return { f, runs };
  }, [route, segments, w, h, pad, trail]);

  if (!groups.f) return <Svg width={w} height={h}>{map ? <MapBackdrop w={w} h={h} seed={seed} /> : null}</Svg>;
  const f = groups.f;
  const start = f(route[0]);
  return (
    <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      {map ? <MapBackdrop w={w} h={h} seed={seed} /> : bg ? <Rect width={w} height={h} fill={bg} /> : null}
      <G fill="none" strokeLinecap="round" strokeLinejoin="round">
        {mode === 'target' ? (
          <Path d={toD(route.map(f))} stroke={C.target} strokeWidth={3} strokeDasharray="2 7" />
        ) : mode === 'route' ? (
          <Path d={toD(route.map(f))} stroke={C.ink} strokeWidth={stroke - 1} />
        ) : (
          groups.runs.map((r, i) =>
            r.color ? (
              <Path key={i} d={toD(r.pts)} stroke={r.color} strokeWidth={stroke} strokeOpacity={mode === 'faded' ? 0.35 : 1} />
            ) : hideRemaining ? null : (
              <Path key={i} d={toD(r.pts)} stroke={C.ink} strokeOpacity={0.45} strokeWidth={2.5} strokeDasharray="4 6" />
            ),
          )
        )}
        {trail && trail.points.length > 1 ? <Path d={toD(trail.points.map(f))} stroke={trail.color} strokeWidth={stroke + 1} /> : null}
      </G>
      {showStart ? <Circle cx={start[0]} cy={start[1]} r={7} fill={C.ink} stroke="#FFFFFF" strokeWidth={3} /> : null}
      {me ? (
        <G>
          <Circle cx={f(me.pos)[0]} cy={f(me.pos)[1]} r={18} fill={me.color} fillOpacity={0.18} />
          <Circle cx={f(me.pos)[0]} cy={f(me.pos)[1]} r={8} fill={me.color} stroke="#FFFFFF" strokeWidth={3} />
        </G>
      ) : null}
    </Svg>
  );
}

/** 그림 아이콘(라이브러리·도감·작은 썸네일) */
export function ShapeGlyph({
  shape,
  w,
  h,
  color = C.ink,
  sw,
  dash,
  bg,
  radius,
}: {
  shape: string;
  w: number | string;
  h: number;
  color?: string;
  sw?: number;
  dash?: string;
  bg?: string;
  radius?: number;
}) {
  const ic = SHAPE_ICONS[shape] ?? SHAPE_ICONS.custom;
  return (
    <Svg width={w as any} height={h} viewBox={ic.box} style={bg ? { backgroundColor: bg, borderRadius: radius ?? 14 } : undefined}>
      <Path d={ic.d} fill="none" stroke={color} strokeWidth={sw ?? ic.sw} strokeDasharray={dash} strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
}
