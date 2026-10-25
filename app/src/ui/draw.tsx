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
  onPan,
  onZoom,
}: {
  w: number;
  h: number;
  strokes: Pt[][];
  onChange: (s: Pt[][]) => void;
  enabled?: boolean;
  mode?: 'draw' | 'erase' | 'off';
  color?: string;
  width?: number;
  /** 두 손가락으로 끌면 화면 이동량(px)을 알린다. 지도 위에서 그리다가 지도를 옮길 때 */
  onPan?: (dx: number, dy: number) => void;
  /** 두 손가락을 벌리면 -1(확대), 오므리면 +1(축소) */
  onZoom?: (d: number) => void;
}) {
  const m = mode ?? (enabled ? 'draw' : 'off');
  const live = useRef<Pt[]>([]);
  const eraser = useRef<Pt | null>(null);
  // 그리는 중인 선은 ref에 두고, 이 값으로 다시 그리기만 일으킨다
  const [, setTick] = useState(0);
  const ref = useRef({ strokes, onChange, m, onPan, onZoom });
  ref.current = { strokes, onChange, m, onPan, onZoom };
  // 두 손가락 제스처: 직전 가운데 점과 손가락 사이 거리(확대 기준)
  const two = useRef<{ c: Pt; d: number } | null>(null);
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
        // 그리는 동안에는 바깥 스크롤·화면 밀기가 손가락을 가져가지 못하게 한다
        onStartShouldSetPanResponderCapture: () => ref.current.m !== 'off',
        onMoveShouldSetPanResponderCapture: () => ref.current.m !== 'off',
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
        onPanResponderMove: (e) => {
          const ts = e.nativeEvent.touches;
          if (ts.length >= 2 && (ref.current.onPan || ref.current.onZoom)) {
            // 두 번째 손가락이 닿으면 그리던 선은 버리고 지도를 움직인다
            live.current = [];
            const c: Pt = [(ts[0].pageX + ts[1].pageX) / 2, (ts[0].pageY + ts[1].pageY) / 2];
            const d = Math.hypot(ts[0].pageX - ts[1].pageX, ts[0].pageY - ts[1].pageY);
            const g = two.current;
            if (g) {
              ref.current.onPan?.(g.c[0] - c[0], g.c[1] - c[1]);
              g.c = c;
              if (d / g.d > 1.35) {
                ref.current.onZoom?.(-1);
                g.d = d;
              } else if (d / g.d < 0.74) {
                ref.current.onZoom?.(1);
                g.d = d;
              }
            } else two.current = { c, d };
            setTick((t) => t + 1);
            return;
          }
          if (two.current) return;
          const p: Pt = [e.nativeEvent.locationX, e.nativeEvent.locationY];
          if (ref.current.m === 'erase') return erase(p);
          const last = live.current[live.current.length - 1];
          if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) > 4) {
            live.current.push(p);
            setTick((t) => t + 1);
          }
        },
        onPanResponderRelease: () => {
          if (live.current.length > 2 && !two.current) ref.current.onChange([...ref.current.strokes, live.current]);
          two.current = null;
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
    // 웹: 브라우저가 손가락 끌기를 스크롤·뒤로 가기로 쓰지 않게 막는다
    <View style={{ width: w, height: h, touchAction: 'none', userSelect: 'none' } as any} {...pan.panHandlers}>
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
  // 끝을 시작점 가까이에서 마쳤을 때만 닫는다. 멀리서 끝내면 시작과 끝이 다른 한 줄 코스(꼭 원처럼 돌아오지 않아도 된다)
  return isClosed(pts) ? toPath(pts) + ' Z' : toPath(pts);
}

/** 끝점이 시작점에서 그림 크기의 12%(최소 24px) 안이면 닫힌 그림으로 본다 */
export function isClosed(pts: Pt[]): boolean {
  if (pts.length < 3) return false;
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const diag = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  const [a, b] = [pts[0], pts[pts.length - 1]];
  return Math.hypot(b[0] - a[0], b[1] - a[1]) <= Math.max(24, diag * 0.12);
}

/** 점을 줄여 모양만 남긴다(Douglas-Peucker) */
function simplify(pts: Pt[], tol: number): Pt[] {
  if (pts.length < 3) return pts;
  const [a, b] = [pts[0], pts[pts.length - 1]];
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  let far = 0;
  let at = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i];
    const d = len > 1 ? Math.abs((b[0] - a[0]) * (a[1] - p[1]) - (a[0] - p[0]) * (b[1] - a[1])) / len : Math.hypot(p[0] - a[0], p[1] - a[1]);
    if (d > far) [far, at] = [d, i];
  }
  if (far <= tol) return [a, b];
  return [...simplify(pts.slice(0, at + 1), tol).slice(0, -1), ...simplify(pts.slice(at), tol)];
}

const cross = (o: Pt, a: Pt, b: Pt) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
const meets = (p1: Pt, p2: Pt, q1: Pt, q2: Pt) =>
  cross(p1, p2, q1) * cross(p1, p2, q2) < 0 && cross(q1, q2, p1) * cross(q1, q2, p2) < 0;

/**
 * 경로로 바꾸기 어려운 그림이면 이유를, 괜찮으면 null.
 * 선이 여러 번 꼬였거나, 끊긴 선이 많거나, 너무 작거나 빽빽하면 다시 그리게 한다.
 */
export function drawingProblem(strokes: Pt[][]): string | null {
  const pts = strokes.flat();
  if (pts.length < 6) return null;
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const diag = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  if (diag < 60) return '그림이 너무 작아요. 더 크게 다시 그려 주세요.';
  const total = strokesLength(strokes);
  let gaps = 0;
  for (let i = 1; i < strokes.length; i++) {
    const [a, b] = [strokes[i - 1][strokes[i - 1].length - 1], strokes[i][0]];
    gaps += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  if (strokes.length > 4 || gaps > total * 0.35) return '선이 여러 번 끊겨 있어요. 한 붓으로 이어서 다시 그려 주세요.';
  if (total / diag > 9) return '그림이 너무 복잡해요. 선을 줄여 단순하게 다시 그려 주세요.';
  // 서버에 보낼 모양 그대로(닫힌 그림만 시작점으로 닫아서) 선끼리 몇 번 겹치는지 센다
  const closed = isClosed(pts);
  const line = simplify(closed ? [...pts, pts[0]] : pts, diag * 0.02);
  let hits = 0;
  for (let i = 0; i < line.length - 1; i++)
    for (let j = i + 2; j < line.length - 1; j++) {
      if (closed && i === 0 && j === line.length - 2) continue;
      if (meets(line[i], line[i + 1], line[j], line[j + 1])) hits++;
    }
  if (hits > 2) return '선이 너무 많이 겹쳐요. 겹치지 않게 다시 그려 주세요.';
  return null;
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
