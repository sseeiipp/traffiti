import QRCode from 'qrcode';
import { useMemo, useRef, useState } from 'react';
import { PanResponder, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { C } from '../theme';

type Pt = [number, number];

/** 손가락으로 그리는 판. strokes는 선 목록, 그리기 모드가 아니면 손가락을 무시한다 */
export function DrawPad({
  w,
  h,
  strokes,
  onChange,
  enabled = true,
  color = C.ink,
  width = 4.5,
}: {
  w: number;
  h: number;
  strokes: Pt[][];
  onChange: (s: Pt[][]) => void;
  enabled?: boolean;
  color?: string;
  width?: number;
}) {
  const live = useRef<Pt[]>([]);
  // 그리는 중인 선은 ref에 두고, 이 값으로 다시 그리기만 일으킨다
  const [, setTick] = useState(0);
  const ref = useRef({ strokes, onChange, enabled });
  ref.current = { strokes, onChange, enabled };
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => ref.current.enabled,
        onMoveShouldSetPanResponder: () => ref.current.enabled,
        onPanResponderGrant: (e) => {
          live.current = [[e.nativeEvent.locationX, e.nativeEvent.locationY]];
          setTick((t) => t + 1);
        },
        onPanResponderMove: (e) => {
          const p: Pt = [e.nativeEvent.locationX, e.nativeEvent.locationY];
          const last = live.current[live.current.length - 1];
          if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) > 4) {
            live.current.push(p);
            setTick((t) => t + 1);
          }
        },
        onPanResponderRelease: () => {
          if (live.current.length > 2) ref.current.onChange([...ref.current.strokes, live.current]);
          live.current = [];
          setTick((t) => t + 1);
        },
      }),
    [],
  );
  const all = live.current.length ? [...strokes, live.current] : strokes;
  return (
    <View style={{ width: w, height: h }} {...pan.panHandlers}>
      <Svg width={w} height={h} pointerEvents="none">
        {all.map((s, i) => (
          <Path key={i} d={toPath(s)} stroke={color} strokeWidth={width} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        ))}
      </Svg>
    </View>
  );
}

export const toPath = (pts: Pt[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');

/** 그린 선들을 한 붓 그림 path로(서버가 실제 좌표로 옮긴다) */
export function strokesToShape(strokes: Pt[][]): string | null {
  const pts = strokes.flat();
  if (pts.length < 6) return null;
  return toPath(pts) + ' Z';
}

export function strokesLength(strokes: Pt[][]) {
  let s = 0;
  for (const st of strokes) for (let i = 1; i < st.length; i++) s += Math.hypot(st[i][0] - st[i - 1][0], st[i][1] - st[i - 1][1]);
  return s;
}

/** 실제로 읽히는 QR 코드 */
export function QR({ text, size = 120 }: { text: string; size?: number }) {
  const { n, d } = useMemo(() => {
    const m = QRCode.create(text, { errorCorrectionLevel: 'M' }).modules;
    let path = '';
    for (let y = 0; y < m.size; y++) for (let x = 0; x < m.size; x++) if (m.get(x, y)) path += `M${x + 4} ${y + 4}h1v1h-1z`;
    return { n: m.size + 8, d: path };
  }, [text]);
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${n} ${n}`}>
      <Rect width={n} height={n} fill="#FFFFFF" />
      <Path d={d} fill={C.ink} />
    </Svg>
  );
}
