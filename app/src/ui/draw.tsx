import QRCode from 'qrcode';
import { useMemo, useRef, useState } from 'react';
import { PanResponder, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { C } from '../theme';

type Pt = [number, number];

const ERASE_R = 16;

/** 지우개가 지나간 자리의 점만 지운다. 선 중간이 지워지면 두 선으로 나뉜다 */
export function eraseAt(strokes: Pt[][], p: Pt, r = ERASE_R): Pt[][] {
  const out: Pt[][] = [];
  let changed = false;
  for (const st of strokes) {
    // 점 사이가 지우개보다 넓으면 중간 점을 채워 넣어 가운데만 지울 수 있게 한다
    const dense: Pt[] = [];
    st.forEach((q, i) => {
      if (i) {
        const a = st[i - 1];
        const n = Math.floor(Math.hypot(q[0] - a[0], q[1] - a[1]) / (r / 2));
        for (let k = 1; k < n; k++) dense.push([a[0] + ((q[0] - a[0]) * k) / n, a[1] + ((q[1] - a[1]) * k) / n]);
      }
      dense.push(q);
    });
    let cur: Pt[] = [];
    for (const q of dense) {
      if (Math.hypot(q[0] - p[0], q[1] - p[1]) <= r) {
        changed = true;
        if (cur.length > 1) out.push(cur);
        cur = [];
      } else cur.push(q);
    }
    if (cur.length > 1) out.push(cur);
    else if (cur.length) changed = true;
  }
  return changed ? out : strokes;
}

/** 손가락으로 그리는 판. mode가 erase면 손가락이 지나간 부분만 지우고, off면 손가락을 무시한다 */
export function DrawPad({
  w,
  h,
  strokes,
  onChange,
  enabled = true,
  mode,
  color = C.ink,
  width = 4.5,
}: {
  w: number;
  h: number;
  strokes: Pt[][];
  onChange: (s: Pt[][]) => void;
  enabled?: boolean;
  mode?: 'draw' | 'erase' | 'off';
  color?: string;
  width?: number;
}) {
  const m = mode ?? (enabled ? 'draw' : 'off');
  const live = useRef<Pt[]>([]);
  const eraser = useRef<Pt | null>(null);
  // 그리는 중인 선은 ref에 두고, 이 값으로 다시 그리기만 일으킨다
  const [, setTick] = useState(0);
  const ref = useRef({ strokes, onChange, m });
  ref.current = { strokes, onChange, m };
  const erase = (p: Pt) => {
    eraser.current = p;
    const next = eraseAt(ref.current.strokes, p);
    if (next !== ref.current.strokes) {
      ref.current.strokes = next;
      ref.current.onChange(next);
    }
    setTick((t) => t + 1);
  };
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => ref.current.m !== 'off',
        onMoveShouldSetPanResponder: () => ref.current.m !== 'off',
        onPanResponderGrant: (e) => {
          const p: Pt = [e.nativeEvent.locationX, e.nativeEvent.locationY];
          if (ref.current.m === 'erase') return erase(p);
          live.current = [p];
          setTick((t) => t + 1);
        },
        onPanResponderMove: (e) => {
          const p: Pt = [e.nativeEvent.locationX, e.nativeEvent.locationY];
          if (ref.current.m === 'erase') return erase(p);
          const last = live.current[live.current.length - 1];
          if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) > 4) {
            live.current.push(p);
            setTick((t) => t + 1);
          }
        },
        onPanResponderRelease: () => {
          if (live.current.length > 2) ref.current.onChange([...ref.current.strokes, live.current]);
          live.current = [];
          eraser.current = null;
          setTick((t) => t + 1);
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const all = live.current.length ? [...strokes, live.current] : strokes;
  return (
    <View style={{ width: w, height: h }} {...pan.panHandlers}>
      <Svg width={w} height={h} pointerEvents="none">
        {all.map((s, i) => (
          <Path key={i} d={toPath(s)} stroke={color} strokeWidth={width} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        ))}
        {eraser.current ? <Circle cx={eraser.current[0]} cy={eraser.current[1]} r={ERASE_R} fill="rgba(255, 255, 255, 0.5)" stroke={C.ink} strokeWidth={1.5} /> : null}
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
