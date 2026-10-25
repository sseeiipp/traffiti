import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, View } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { MapBackdrop } from '../map/MapArt';
import { SHAPE_ICONS } from '../map/shapes';
import type { P } from '../navigation/types';
import { C, font } from '../theme';
import { Btn, H1, T, Tap, useBottom, useTop } from '../ui/kit';
import { WHALE_PARTS } from './common';

const WHALE = SHAPE_ICONS.whale.d;

/** 꺾은선 path(M/L)의 길이 */
function polyLength(d: string) {
  const n = (d.match(/-?\d+\.?\d*/g) ?? []).map(Number);
  let len = 0;
  for (let i = 2; i + 1 < n.length; i += 2) len += Math.hypot(n[i] - n[i - 2], n[i + 1] - n[i - 1]);
  if (/z/i.test(d)) len += Math.hypot(n[0] - n[n.length - 2], n[1] - n[n.length - 1]);
  return len;
}

/** 시작부터 흐른 시간(ms). 동작 줄이기가 켜져 있으면 처음부터 끝 상태 */
function useClock(key: number, reduce: boolean) {
  const [t, setT] = useState(reduce ? 1e9 : 0);
  useEffect(() => {
    if (reduce) {
      setT(1e9);
      return;
    }
    setT(0);
    const start = Date.now();
    let raf = 0;
    const tick = () => {
      const e = Date.now() - start;
      setT(e);
      if (e < 4200) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [key, reduce]);
  return t;
}

const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2); // cubic-bezier(.65,0,.35,1) 근사
const prog = (t: number, delay: number, dur: number) => Math.max(0, Math.min(1, (t - delay) / dur));
/** 선이 그려지는 정도(0~1)에 맞춘 점선 */
const drawn = (d: string, p: number) => {
  const L = polyLength(d);
  return { strokeDasharray: `${L} ${L}`, strokeDashoffset: L * (1 - ease(p)) };
};
/** 작은 것이 튀어나오는 정도 */
const pop = (t: number, delay: number) => {
  const p = prog(t, delay, 500);
  const s = 0.6 + 0.4 * (1 - Math.pow(1 - p, 3));
  return { opacity: p, s };
};

function Slide1({ t }: { t: number }) {
  const dot = pop(t, 1800);
  return (
    <Svg viewBox="0 0 350 380" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
      <MapBackdrop w={350} h={380} />
      <G transform="translate(15 95)" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <Path d={WHALE} stroke={C.ink} strokeOpacity={0.22} strokeWidth={3} strokeDasharray="2 8" />
        <Path d={WHALE} stroke={C.ink} strokeWidth={7} {...drawn(WHALE, prog(t, 300, 1600))} />
        <G opacity={dot.opacity}>
          <Circle cx={30} cy={100} r={16 * dot.s} fill={C.lime} fillOpacity={0.35} />
          <Circle cx={30} cy={100} r={7 * dot.s} fill={C.lime} stroke="#FFFFFF" strokeWidth={3} />
        </G>
      </G>
    </Svg>
  );
}

const MATES = [
  { l: '지', x: 70, y: 28 },
  { l: '민', x: 220, y: 34 },
  { l: '서', x: 300, y: 142 },
  { l: '도', x: 96, y: 170 },
];

function Slide2({ t }: { t: number }) {
  return (
    <Svg viewBox="0 0 350 380" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
      <MapBackdrop w={350} h={380} />
      <G transform="translate(15 95)" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <Path d={WHALE} stroke={C.ink} strokeOpacity={0.18} strokeWidth={3} strokeDasharray="2 8" />
        {WHALE_PARTS.map((d, i) => (
          <Path key={i} d={d} stroke={C.members[i]} strokeWidth={8} {...drawn(d, prog(t, 300 + i * 750, 900))} />
        ))}
        {MATES.map((m, i) => {
          const p = pop(t, 900 + i * 750);
          return (
            <G key={m.l} opacity={p.opacity}>
              <Circle cx={m.x} cy={m.y} r={15 * p.s} fill={C.members[i]} stroke="#FFFFFF" strokeWidth={3} />
              <SvgText x={m.x} y={m.y + 5} textAnchor="middle" fontSize={13} fontWeight="700" fill="#FFFFFF" fontFamily={font.text}>
                {m.l}
              </SvgText>
            </G>
          );
        })}
      </G>
    </Svg>
  );
}

function Tile({ x, y, shape, label, got, t, delay }: { x: number; y: number; shape: string; label: string; got: boolean; t: number; delay: number }) {
  const ic = SHAPE_ICONS[shape];
  const p = pop(t, delay);
  const [bx, by, bw, bh] = ic.box.split(' ').map(Number);
  // 아이콘을 80×64 칸에 맞춘다
  const k = Math.min(80 / bw, 64 / bh);
  return (
    <G opacity={p.opacity}>
      <Rect x={x} y={y} width={132} height={132} rx={24} fill={got ? '#ECFCCB' : '#FFFFFF'} />
      <G transform={`translate(${x + 26 + (80 - bw * k) / 2} ${y + 22 + (64 - bh * k) / 2}) scale(${k}) translate(${-bx} ${-by})`}>
        <Path
          d={ic.d}
          fill="none"
          stroke={got ? C.limeText : '#C7C7CC'}
          strokeWidth={ic.sw}
          strokeDasharray={got ? undefined : `${ic.sw} ${ic.sw * 1.6}`}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </G>
      <SvgText x={x + 66} y={y + 112} textAnchor="middle" fontSize={14} fontWeight="600" fill={got ? C.ink : C.sub2} fontFamily={font.text}>
        {label}
      </SvgText>
    </G>
  );
}

function Slide3({ t }: { t: number }) {
  const lv = pop(t, 1100);
  const gold = pop(t, 1300);
  const friend = pop(t, 1500);
  return (
    <Svg viewBox="0 0 350 380" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      <Rect width={350} height={380} fill={C.soft} />
      <Tile x={37} y={40} shape="heart" label="하트" got t={t} delay={200} />
      <Tile x={181} y={40} shape="star" label="별" got t={t} delay={380} />
      <Tile x={37} y={180} shape="whale" label="고래" got t={t} delay={560} />
      <Tile x={181} y={180} shape="bolt" label="?" got={false} t={t} delay={740} />
      <G opacity={lv.opacity}>
        <Rect x={236} y={18} width={78} height={30} rx={15} fill={C.ink} />
        <SvgText x={275} y={38} textAnchor="middle" fontSize={13} fontWeight="800" fill={C.lime} fontFamily={font.rounded}>
          Lv 7
        </SvgText>
      </G>
      <Defs>
        <LinearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
          <Stop offset={0} stopColor="#FEF3C7" />
          <Stop offset={1} stopColor="#FBBF24" />
        </LinearGradient>
      </Defs>
      <G opacity={gold.opacity}>
        <Rect x={40} y={326} width={62} height={30} rx={15} fill="#B45309" />
        <Rect x={40} y={324} width={62} height={30} rx={15} fill="url(#gold)" />
        <SvgText x={71} y={344} textAnchor="middle" fontSize={13} fontWeight="700" fill="#713F12" fontFamily={font.text}>
          골드
        </SvgText>
      </G>
      <G opacity={friend.opacity}>
        <Rect x={112} y={324} width={198} height={30} rx={15} fill="#FFFFFF" />
        <SvgText x={211} y={344} textAnchor="middle" fontSize={13} fontWeight="600" fill={C.ink} fontFamily={font.text}>
          친구와 코드 하나로 함께
        </SvgText>
      </G>
    </Svg>
  );
}

const SLIDES = [
  { title: '달린 길이\n그대로 그림이 돼요', body: '고래, 하트, 별… 그림 모양을 따라 달리면 GPS 경로가 한 장의 작품으로 남아요.', Art: Slide1, bg: C.map.land },
  { title: '크루가 나눠 달려\n함께 완성해요', body: '한 번에 다 달리지 않아도 돼요. 각자 편할 때 구간을 채우면 크루원마다 다른 색으로 이어져요.', Art: Slide2, bg: C.map.land },
  {
    title: '작품을 모으고\n크루와 함께 올라가요',
    body: '그림 도감을 채우고 크루 레벨과 순위를 올려요. 크루가 없어도 친구와 코드 하나로 시작할 수 있어요.',
    Art: Slide3,
    bg: C.soft,
  },
];

// ---------- 00-1~3 소개 ----------

export function Onboard({ navigation }: P<'Onboard'>) {
  const top = useTop();
  const b = useBottom();
  const [i, setI] = useState(0);
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduce)
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => sub.remove();
  }, []);
  const t = useClock(i, reduce);
  const s = SLIDES[i];
  const up = prog(t, 100, 600);
  const done = () => navigation.replace('Intro');
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ marginTop: top + 2, height: 44, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' }}>
        <Tap noScale onPress={done} style={{ minHeight: 44, paddingHorizontal: 4, justifyContent: 'center' }}>
          <T size={15} weight="500" color={C.sub}>
            건너뛰기
          </T>
        </Tap>
      </View>
      <View
        accessibilityRole="image"
        accessibilityLabel={s.title.replace('\n', ' ')}
        style={{
          flexGrow: 1,
          flexShrink: 1,
          flexBasis: 380,
          minHeight: 110,
          maxHeight: 420,
          marginTop: 14,
          marginHorizontal: 20,
          borderRadius: 28,
          overflow: 'hidden',
          backgroundColor: s.bg,
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04), 0 10px 30px rgba(0, 0, 0, 0.06)',
        }}
      >
        <s.Art t={t} />
      </View>
      <View style={{ marginTop: 20, marginHorizontal: 24, gap: 12, opacity: up, transform: [{ translateY: 12 * (1 - up) }] }}>
        <H1 size={28}>{s.title}</H1>
        <T size={15} color={C.sub} lh={1.6}>
          {s.body}
        </T>
      </View>
      <View style={{ marginTop: 'auto', paddingTop: 16, paddingHorizontal: 20, paddingBottom: Math.max(28, b - 6), alignItems: 'center', gap: 16 }}>
        <View accessibilityLabel="소개 순서" style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          {SLIDES.map((_, k) => (
            <Dot key={k} on={k === i} reduce={reduce} label={`${k + 1}번째 소개`} onPress={() => setI(k)} />
          ))}
        </View>
        <Btn title={i < 2 ? '다음' : '시작하기'} style={{ alignSelf: 'stretch' }} onPress={() => (i < 2 ? setI(i + 1) : done())} />
      </View>
    </View>
  );
}

/** 지금 점은 길어지며 이동한다 */
function Dot({ on, reduce, label, onPress }: { on: boolean; reduce: boolean; label: string; onPress: () => void }) {
  const w = useRef(new Animated.Value(on ? 24 : 8)).current;
  useEffect(() => {
    if (reduce) w.setValue(on ? 24 : 8);
    else Animated.timing(w, { toValue: on ? 24 : 8, duration: 500, easing: Easing.bezier(0.22, 1, 0.36, 1), useNativeDriver: false }).start();
  }, [on, reduce, w]);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: on }} onPress={onPress} hitSlop={10}>
      <Animated.View style={{ height: 8, borderRadius: 4, width: w, backgroundColor: on ? C.lime : '#D1D1D6' }} />
    </Pressable>
  );
}
