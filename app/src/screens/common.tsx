import { useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { MapBackdrop } from '../map/MapArt';
import { C } from '../theme';

export const WHALE_PARTS = [
  'M30 100 L32 80 L50 62 L80 50 L110 42 L140 40',
  'M140 40 L170 42 L200 48 L222 62 L240 80 L250 100 L268 82 L290 70',
  'M290 70 L282 100 L290 130 L268 118 L250 110 L236 128 L210 142 L180 148',
  'M180 148 L140 150 L100 148 L66 140 L42 124 L30 100',
];

/** 시작 화면 위쪽의 지도 + 네 색으로 그린 고래 */
export function HeroMap({ h, stroke = 6, dot, dy = 80 }: { h: number; stroke?: number; dot?: boolean; dy?: number }) {
  const { width } = useWindowDimensions();
  const w = Math.min(width, 430);
  return (
    <Svg width={w} height={h} viewBox={`0 0 390 ${h}`} preserveAspectRatio="xMidYMid slice">
      <MapBackdrop w={390} h={h} />
      <G transform={`translate(45 ${dy})`} fill="none" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
        {WHALE_PARTS.map((d, i) => (
          <Path key={i} d={d} stroke={C.members[i]} />
        ))}
        {dot ? <Circle cx={74} cy={88} r={5} fill={C.ink} stroke="none" /> : null}
      </G>
    </Svg>
  );
}

export function useBoxWidth(pad = 20) {
  const { width } = useWindowDimensions();
  return Math.min(width, 430) - pad * 2;
}

/** 자식 크기를 재서 넘겨준다(SVG가 정확한 픽셀 폭을 원할 때) */
export function Measure({ height, children }: { height: number; children: (w: number) => React.ReactNode }) {
  const [w, setW] = useState(0);
  return (
    <View style={{ height }} onLayout={(e) => setW(Math.floor(e.nativeEvent.layout.width))}>
      {w > 0 ? children(w) : null}
    </View>
  );
}

// ---------- 표시 형식 ----------

const WD = ['일', '월', '화', '수', '목', '금', '토'];

export const md = (iso: string | Date | number) => {
  const d = new Date(iso);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
};
export const mdw = (iso: string | Date | number) => {
  const d = new Date(iso);
  return `${md(d)} ${WD[d.getDay()]}요일`;
};
export const ymd = (iso: string | Date | number) => {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
};
export const hm = (iso: string | Date | number) => {
  const d = new Date(iso);
  const h = d.getHours();
  return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')}`;
};
export const clock = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = Math.floor(s % 60);
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}` : `${m}:${String(ss).padStart(2, '0')}`;
};
export const pace = (s: number | null) => (s == null || !isFinite(s) || s <= 0 ? `–'––"` : `${Math.floor(s / 60)}'${String(Math.round(s % 60)).padStart(2, '0')}"`);
export const pct = (v: number | null | undefined) => `${Math.round((v ?? 0) * 100)}%`;
export const km1 = (v: number) => (Math.round(v * 10) / 10).toFixed(1);

/** 진행 막대용: 사람별 비율 */
export const partsOf = (contributors: { color: string; share: number }[]) => contributors.map((c) => ({ color: c.color, value: c.share }));
