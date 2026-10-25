import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import * as Location from 'expo-location';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { api } from '../api/client';
import { useAction, useChallenge, useCrew, useCurrentCrewId, useMe } from '../api/hooks';
import { MapBackdrop, RouteArt, ShapeGlyph, type LatLng } from '../map/MapArt';
import { FRIEND_SHAPES, SHAPE_ICONS, shapeLabel } from '../map/shapes';
import type { P } from '../navigation/types';
import { useAuth } from '../store/auth';
import { START_SPOTS, useDraft } from '../store/draft';
import { C, shadow } from '../theme';
import { DrawPad, QR, strokesLength, strokesToShape } from '../ui/draw';
import { IcCheck, IcChevron, IcEraser, IcLink, IcMove, IcPen, IcSearch, IcUndo } from '../ui/icons';
import {
  Avatar,
  Btn,
  Chip,
  CodeCells,
  ErrorText,
  Field,
  Glass,
  H1,
  Handle,
  Loading,
  NavBar,
  Pill,
  RadioRow,
  RoundBtn,
  Screen,
  Segmented,
  Sheet,
  StatCard,
  Sub,
  T,
  Tap,
  TextLink,
  useBottom,
  useTop,
} from '../ui/kit';
import { md, Measure } from './common';

type Pt = [number, number];

// ---------- 07 챌린지 만들기 방식 선택 ----------

export function CreateMethod({ navigation }: P<'CreateMethod'>) {
  const draft = useDraft();
  const card = (selected?: boolean) => ({
    minHeight: 132,
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row' as const,
    gap: 14,
    alignItems: 'center' as const,
    ...(selected ? { backgroundColor: 'rgba(236, 252, 203, 0.9)', boxShadow: shadow.selected } : {}),
  });
  return (
    <Screen gap={18}>
      <NavBar onBack={() => navigation.goBack()} kind="close" title="새 챌린지" step="1 / 4" />
      <H1 size={26}>어떤 그림을 달릴까요?</H1>
      <Tap
        onPress={() => {
          draft.reset();
          navigation.navigate('CourseSelect');
        }}
      >
        <Glass style={card(true)}>
          <ShapeGlyph shape="whale" w={96} h={96} sw={12} bg={C.map.land} />
          <View style={{ flex: 1, gap: 6 }}>
            <Pill label="바로 달릴 수 있어요" />
            <T size={17} weight="700">
              그림 라이브러리
            </T>
            <T size={13} color={C.sub} lh={1.45}>
              미리 검증한 그림과 코스 중에서 골라요.
            </T>
          </View>
        </Glass>
      </Tap>
      <Tap
        onPress={() => {
          draft.reset();
          draft.set({ mode: 'map', shapeKey: null });
          navigation.navigate('DrawMap');
        }}
      >
        <Glass style={card()}>
          <Svg viewBox="0 0 96 96" width={96} height={96} style={{ backgroundColor: C.map.land, borderRadius: 14 }}>
            <Path d="M0 30 L96 24 M0 66 L96 60 M30 0 L26 96 M68 0 L70 96" stroke="#FFFFFF" strokeWidth={4} fill="none" />
            <Path
              d="M30 70 C26 56 30 46 36 40 C32 28 32 18 38 16 C44 18 44 30 46 38 C50 36 54 36 58 38 C60 28 62 18 68 18 C72 22 70 34 66 42 C74 46 78 54 76 62 C74 70 64 72 52 72 C42 72 32 74 30 70 Z"
              fill="none"
              stroke={C.target}
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
          <View style={{ flex: 1, gap: 6 }}>
            <Pill label="지원 지역에서만" bg={C.seg} />
            <T size={17} weight="700">
              지도 위에 직접 그리기
            </T>
            <T size={13} color={C.sub} lh={1.45}>
              달릴 동네 위에 손가락으로 그려요.
            </T>
          </View>
        </Glass>
      </Tap>
      <Tap
        onPress={() => {
          draft.reset();
          draft.set({ mode: 'sketch', shapeKey: null });
          navigation.navigate('Sketchbook');
        }}
      >
        <Glass style={card()}>
          <View style={{ width: 96, height: 96, borderRadius: 14, backgroundColor: '#FFFFFF', boxShadow: '0 2px 10px rgba(0, 0, 0, 0.07), 0 1px 3px rgba(0, 0, 0, 0.05)' }}>
            <Svg viewBox="0 0 96 96" width={96} height={96}>
              <Path d="M48 16 L56 38 L80 40 L62 54 L68 78 L48 65 L28 78 L34 54 L16 40 L40 38 Z" fill="none" stroke={C.ink} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            <Pill label="그린 뒤 지역 선택" bg={C.seg} />
            <T size={17} weight="700">
              스케치북에 그리기
            </T>
            <T size={13} color={C.sub} lh={1.45}>
              흰 종이에 먼저 그리고 달릴 곳을 정해요.
            </T>
          </View>
        </Glass>
      </Tap>
      <T size={13} color={C.sub} lh={1.5}>
        직접 그린 그림은 길이 없으면 경로가 되지 않을 수 있어요. 그럴 땐 이유와 다른 방법을 알려드려요.
      </T>
    </Screen>
  );
}

// ---------- 08 그림 라이브러리 ----------

interface ShapeInfo {
  key: string;
  label: string;
  km: number;
  difficulty: string;
  library: boolean;
}

export function CourseSelect({ navigation }: P<'CourseSelect'>) {
  const draft = useDraft();
  const [range, setRange] = useState<'all' | 'short' | 'long'>('all');
  const shapes = useQuery({ queryKey: ['shapes'], queryFn: () => api<ShapeInfo[]>('/shapes') });
  const list = (shapes.data ?? []).filter((s) => s.library).filter((s) => (range === 'all' ? true : range === 'short' ? s.km < 5 : s.km >= 5));
  const sel = shapes.data?.find((s) => s.key === draft.shapeKey);
  return (
    <Screen
      gap={14}
      footer={<Btn title={sel ? `${sel.label} 코스 경로 확인` : '그림을 골라 주세요'} disabled={!sel} onPress={() => navigation.navigate('RouteReview')} />}
    >
      <NavBar onBack={() => navigation.goBack()} title="그림 라이브러리" step="2 / 4" />
      <Glass style={{ alignSelf: 'flex-start', height: 32, paddingHorizontal: 12, borderRadius: 16, justifyContent: 'center' }}>
        <T size={13} weight="500">
          {draft.areaLabel}
        </T>
      </Glass>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {(
          [
            ['all', '전체'],
            ['short', '5km 미만'],
            ['long', '5km 이상'],
          ] as const
        ).map(([k, l]) => (
          <Chip key={k} label={l} on={range === k} onPress={() => setRange(k)} />
        ))}
      </View>
      {shapes.isLoading ? <Loading /> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {list.map((s) => {
          const on = s.key === draft.shapeKey;
          return (
            <Tap key={s.key} onPress={() => draft.set({ shapeKey: s.key, km: null })} style={{ width: '47%', flexGrow: 1 }}>
              <Glass style={{ borderRadius: 20, padding: 8, gap: 8, ...(on ? { backgroundColor: 'rgba(236, 252, 203, 0.9)', boxShadow: shadow.selected } : {}) }}>
                <ShapeGlyph shape={s.key} w="100%" h={118} sw={SHAPE_ICONS[s.key].sw * 0.55} bg={C.map.land} />
                <View style={{ paddingHorizontal: 4, paddingBottom: 4, gap: 3 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <T size={15} weight="600">
                      {s.label}
                    </T>
                    {on ? (
                      <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' }}>
                        <IcCheck size={13} color="#FFFFFF" w={2.6} />
                      </View>
                    ) : null}
                  </View>
                  <T size={12} color={C.sub}>
                    <T size={12} color={C.sub} rounded>
                      {s.km}km
                    </T>{' '}
                    · 난이도 {s.difficulty}
                  </T>
                </View>
              </Glass>
            </Tap>
          );
        })}
      </View>
    </Screen>
  );
}

// ---------- 그리기 도구 ----------

function Tools({ tool, setTool, onUndo, onClear, withMove, white }: {
  tool: 'pen' | 'move';
  setTool: (t: 'pen' | 'move') => void;
  onUndo: () => void;
  onClear: () => void;
  withMove?: boolean;
  white?: boolean;
}) {
  const btn = (on: boolean) => ({ width: 48, height: 48, borderRadius: 12, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: on ? C.limeGlass : 'transparent' });
  const Box = white ? View : Glass;
  return (
    <Box style={{ flexDirection: 'row', gap: 4, padding: 4, borderRadius: white ? 16 : 20, backgroundColor: white ? '#FFFFFF' : undefined, boxShadow: white ? shadow.soft : undefined }}>
      <Tap label="펜" onPress={() => setTool('pen')} style={btn(tool === 'pen')}>
        <IcPen />
      </Tap>
      <Tap label="지우개" onPress={onClear} style={btn(false)}>
        <IcEraser />
      </Tap>
      <Tap label="되돌리기" onPress={onUndo} style={btn(false)}>
        <IcUndo />
      </Tap>
      {withMove ? (
        <Tap label="지도 이동 모드" onPress={() => setTool('move')} style={btn(tool === 'move')}>
          <IcMove />
        </Tap>
      ) : null}
    </Box>
  );
}

// ---------- 09 지도 위 직접 그리기 ----------

export function DrawMap({ navigation }: P<'DrawMap'>) {
  const draft = useDraft();
  const top = useTop();
  const b = useBottom();
  const [strokes, setStrokes] = useState<Pt[][]>([]);
  const [tool, setTool] = useState<'pen' | 'move'>('pen');
  const [size, setSize] = useState({ w: 390, h: 700 });
  // 지원 지역 상자(화면 안 비율) 안의 선 길이를 실제 거리로 환산: 상자 폭 ≈ 2.2km
  const box = { x: 22, y: 130, w: size.w - 44, h: 390 };
  const km = Math.round(((strokesLength(strokes) / box.w) * 2.2) * 10) / 10;
  const path = strokesToShape(strokes);
  return (
    <View style={{ flex: 1, backgroundColor: C.map.land }} onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      <Svg width={size.w} height={size.h} style={StyleSheet.absoluteFill}>
        <MapBackdrop w={size.w} h={size.h} seed={5} />
        <Path d={`M${box.x + 20} ${box.y} h${box.w - 40} a20 20 0 0 1 20 20 v${box.h - 40} a20 20 0 0 1 -20 20 h-${box.w - 40} a20 20 0 0 1 -20 -20 v-${box.h - 40} a20 20 0 0 1 20 -20 z`} fill="none" stroke={C.ink} strokeWidth={1.5} strokeDasharray="6 6" />
      </Svg>
      <View style={[StyleSheet.absoluteFill]}>
        <DrawPad w={size.w} h={size.h} strokes={strokes} onChange={setStrokes} enabled={tool === 'pen'} color={C.target} />
      </View>
      <View pointerEvents="box-none" style={{ position: 'absolute', left: 16, right: 16, top: top + 2, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <RoundBtn onPress={() => navigation.goBack()} />
        <Glass style={{ height: 44, paddingHorizontal: 14, borderRadius: 22, justifyContent: 'center' }}>
          <T size={14} weight="600">
            {draft.areaLabel}
          </T>
        </Glass>
        <Glass style={{ marginLeft: 'auto', height: 32, paddingHorizontal: 10, borderRadius: 16, justifyContent: 'center' }}>
          <T size={13} weight="600" rounded>
            2 / 4
          </T>
        </Glass>
      </View>
      <View pointerEvents="none" style={{ position: 'absolute', left: 34, top: box.y + 12, backgroundColor: C.lime, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
        <T size={12} weight="600">
          지원 지역 · 이 안에서 그려요
        </T>
      </View>
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 162 + b - 34, alignItems: 'center' }}>
        <Tools tool={tool} setTool={setTool} onUndo={() => setStrokes(strokes.slice(0, -1))} onClear={() => setStrokes([])} withMove />
      </View>
      <Glass kind="sheet" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, borderRadius: 0, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 18, paddingHorizontal: 20, paddingBottom: b, gap: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
          <T size={13} color={C.sub}>
            선 길이 약{' '}
            <T size={13} weight="700" rounded>
              {km}km
            </T>
          </T>
        </View>
        <Btn
          title={path ? '이 그림으로 경로 찾기' : '지도 위에 그림을 그려 주세요'}
          disabled={!path}
          onPress={() => {
            draft.set({ customPath: path, km: Math.max(1, Math.min(15, km)) });
            navigation.navigate('RouteReview');
          }}
        />
      </Glass>
    </View>
  );
}

// ---------- 10 스케치북 ----------

export function Sketchbook({ navigation }: P<'Sketchbook'>) {
  const draft = useDraft();
  const [strokes, setStrokes] = useState<Pt[][]>([]);
  const [tool, setTool] = useState<'pen' | 'move'>('pen');
  const path = strokesToShape(strokes);
  return (
    <Screen
      gap={14}
      scroll={false}
      footer={
        <Btn
          title="다음: 달릴 곳 정하기"
          disabled={!path}
          onPress={() => {
            draft.set({ customPath: path, km: 5.2 });
            navigation.navigate('AreaPick');
          }}
        />
      }
    >
      <NavBar onBack={() => navigation.goBack()} title="스케치북" right={<TextLink title="전체 지우기" color={C.body2} onPress={() => setStrokes([])} />} />
      <Glass style={{ height: 500, borderRadius: 20 }}>
        <Measure height={500}>{(w) => <DrawPad w={w} h={500} strokes={strokes} onChange={setStrokes} enabled={tool === 'pen'} />}</Measure>
        <T size={12} color={C.sub} style={{ position: 'absolute', left: 16, top: 14 }}>
          한 붓으로, 끝을 시작점에 이어 그려요
        </T>
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 14, alignItems: 'center' }}>
          <Tools white tool={tool} setTool={setTool} onUndo={() => setStrokes(strokes.slice(0, -1))} onClear={() => setStrokes([])} />
        </View>
      </Glass>
    </Screen>
  );
}

// ---------- 11 지역 · 출발 지점 선택 ----------

function Slider({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (v: number) => void }) {
  const [w, setW] = useState(1);
  const ref = useRef({ w, min, max, onChange });
  ref.current = { w, min, max, onChange };
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => set(e.nativeEvent.locationX),
        onPanResponderMove: (e) => set(e.nativeEvent.locationX),
      }),
    [],
  );
  function set(x: number) {
    const r = ref.current;
    const v = r.min + Math.max(0, Math.min(1, x / r.w)) * (r.max - r.min);
    r.onChange(Math.round(v * 10) / 10);
  }
  const f = (value - min) / (max - min);
  return (
    <View accessibilityRole="adjustable" style={{ height: 44, justifyContent: 'center' }} onLayout={(e) => setW(e.nativeEvent.layout.width)} {...pan.panHandlers}>
      <View pointerEvents="none" style={{ height: 4, borderRadius: 2, backgroundColor: C.line }}>
        <View style={{ width: `${f * 100}%`, height: 4, borderRadius: 2, backgroundColor: C.ink }} />
      </View>
      <View pointerEvents="none" style={{ position: 'absolute', left: `${f * 100}%`, marginLeft: -13, width: 26, height: 26, borderRadius: 13, backgroundColor: '#FFFFFF', boxShadow: '0 2px 6px rgba(0, 0, 0, 0.25)' }} />
    </View>
  );
}

export function AreaPick({ navigation }: P<'AreaPick'>) {
  const draft = useDraft();
  const top = useTop();
  const b = useBottom();
  const [q, setQ] = useState('');
  const spots = START_SPOTS.filter((s) => !q || s.label.includes(q) || s.area.includes(q));
  return (
    <View style={{ flex: 1, backgroundColor: C.map.land }}>
      <Svg width="100%" height={600} viewBox="0 0 390 600" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', top: 0 }}>
        <MapBackdrop w={390} h={600} seed={7} />
        <Path d="M76 156 h238 v236 h-238 z" fill="#FFFFFF" fillOpacity={0.35} stroke={C.ink} strokeWidth={1.5} strokeDasharray="5 5" />
      </Svg>
      <View style={{ position: 'absolute', top: 156, left: 0, right: 0, alignItems: 'center' }} pointerEvents="none">
        {draft.customPath ? <ShapeFromPath d={draft.customPath} size={236} /> : null}
      </View>
      <View style={{ position: 'absolute', left: 16, right: 16, top: top + 2, flexDirection: 'row', gap: 8 }}>
        <RoundBtn onPress={() => navigation.goBack()} />
        <Glass style={{ flex: 1, height: 48, borderRadius: 24, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16 }}>
          <IcSearch size={18} color={C.sub} w={2} />
          <Field value={q} onChangeText={setQ} placeholder="지역 또는 장소 검색" height={46} style={{ backgroundColor: 'transparent', paddingHorizontal: 0, fontSize: 15 }} />
        </Glass>
      </View>
      <Glass kind="sheet" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, borderRadius: 0, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingTop: 20, paddingHorizontal: 20, paddingBottom: b, gap: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <H1 size={26}>어디서 달릴까요?</H1>
          <T size={13} weight="600" color={C.sub} rounded>
            3 / 4
          </T>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {spots.map((s) => (
            <Chip key={s.label} label={s.label} on={draft.startLabel === s.label} onPress={() => draft.set({ start: s.pos, startLabel: s.label, areaLabel: s.area })} />
          ))}
        </ScrollView>
        <Glass style={{ minHeight: 52, borderRadius: 20, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <T size={14} color={C.sub}>
            출발 지점
          </T>
          <T size={14} weight="600">
            {draft.startLabel}
          </T>
        </Glass>
        <View style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <T size={13} weight="600">
              그림 크기
            </T>
            <T size={13} color={C.sub}>
              선 길이 약{' '}
              <T size={13} weight="700" rounded>
                {(draft.km ?? 5.2).toFixed(1)}km
              </T>
            </T>
          </View>
          <Slider value={draft.km ?? 5.2} min={1} max={15} onChange={(v) => draft.set({ km: v })} />
        </View>
        <Btn title="이 위치에서 경로 찾기" onPress={() => navigation.navigate('RouteReview')} />
      </Glass>
    </View>
  );
}

function ShapeFromPath({ d, size }: { d: string; size: number }) {
  const nums = d.match(/-?\d+\.?\d*/g)?.map(Number) ?? [];
  const xs = nums.filter((_, i) => i % 2 === 0);
  const ys = nums.filter((_, i) => i % 2 === 1);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const span = Math.max(Math.max(...xs) - minX, Math.max(...ys) - minY, 1);
  return (
    <Svg width={size} height={size} viewBox={`${minX - span * 0.1} ${minY - span * 0.1} ${span * 1.2} ${span * 1.2}`}>
      <Path d={d} fill="none" stroke={C.target} strokeWidth={span / 60} strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
}

// ---------- 12 경로 제안 ----------

interface Suggestion {
  ok: boolean;
  route?: LatLng[];
  distanceKm?: number;
  difficulty?: string;
  similarity?: number | null;
  reason?: string;
  alternatives?: string[];
}

export function RouteReview({ navigation }: P<'RouteReview'>) {
  const draft = useDraft();
  const top = useTop();
  const body = { shapeKey: draft.shapeKey ?? undefined, customPath: draft.customPath ?? undefined, start: draft.start, km: draft.km ?? undefined };
  const q = useQuery({
    queryKey: ['suggest', body],
    queryFn: async () => {
      // 찾는 과정을 잠깐 보여준다
      const [r] = await Promise.all([api<Suggestion>('/routes/suggest', { body }), new Promise((res) => setTimeout(res, 1200))]);
      return r;
    },
  });
  const s = q.data;
  const name = draft.customPath ? '그림' : shapeLabel(draft.shapeKey ?? '');
  return (
    <View style={{ flex: 1, backgroundColor: C.map.land }}>
      <Measure height={460}>
        {(w) =>
          s?.ok && s.route ? (
            <RouteArt route={s.route} w={w} h={460} pad={48} mode="route" showStart seed={2} />
          ) : (
            <Svg width={w} height={460}>
              <MapBackdrop w={w} h={460} seed={2} />
            </Svg>
          )
        }
      </Measure>
      <RoundBtn onPress={() => navigation.goBack()} style={{ position: 'absolute', left: 16, top: top + 2 }} />
      <Glass style={{ position: 'absolute', right: 16, top: top + 6, height: 36, paddingHorizontal: 12, borderRadius: 18, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Svg width={18} height={6}>
          <Path d="M1 3h16" stroke={C.ink} strokeWidth={3.5} strokeLinecap="round" />
        </Svg>
        <T size={12} weight="500">
          제안 경로
        </T>
      </Glass>
      <Glass
        kind="sheet"
        intensity={50}
        style={{ position: 'absolute', left: 10, right: 10, top: 430, bottom: 10, borderRadius: 36, backgroundColor: 'rgba(255, 255, 255, 0.5)', paddingTop: 10, paddingHorizontal: 18, paddingBottom: 20, gap: 16, boxShadow: shadow.sheet }}
      >
        <Handle />
        {q.isLoading ? (
          <View style={{ gap: 18, flex: 1 }}>
            <View style={{ gap: 4 }}>
              <H1 size={26}>달릴 수 있는 길을 찾고 있어요</H1>
              <T size={13} color={C.sub}>
                {draft.areaLabel} · 보행 도로 기준
              </T>
            </View>
            {['그림 선을 경유점으로 나누는 중', '출발 지점에 맞춰 크기를 맞추는 중', '거리와 난이도 계산'].map((t, i) => (
              <T key={t} size={15} weight={i === 0 ? '600' : '400'} color={i === 0 ? C.ink : C.sub}>
                {i === 0 ? '◐ ' : '○ '}
                {t}
              </T>
            ))}
            <Btn title="취소하고 위치 바꾸기" kind="secondary" style={{ marginTop: 'auto' }} onPress={() => navigation.goBack()} />
          </View>
        ) : s?.ok ? (
          <View style={{ gap: 16, flex: 1 }}>
            <View style={{ gap: 4 }}>
              <H1 size={26}>달릴 수 있는 {name}{draft.customPath ? '을' : '를'} 찾았어요</H1>
              <T size={13} color={C.sub}>
                {draft.areaLabel} · 출발 {draft.startLabel}
              </T>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <StatCard label="예상 거리" value={String(s.distanceKm)} unit=" km" />
              <StatCard label="그림과 닮은 정도" value={s.similarity == null ? '—' : String(s.similarity)} unit={s.similarity == null ? '' : '%'} />
              <StatCard label="난이도" value={s.difficulty ?? ''} plain />
            </View>
            <T size={12} color={C.sub} lh={1.5}>
              지도 SDK·경로 API를 연결하기 전이라 그림 선을 그대로 경로로 보여줘요. 공사나 통행 제한은 반영되지 않으니 달리기 전에 한 번 확인해 주세요.
            </T>
            <View style={{ marginTop: 'auto', flexDirection: 'row', gap: 8 }}>
              <Btn title="다시 그리기" kind="secondary" style={{ width: 112 }} onPress={() => navigation.goBack()} />
              <Btn title="이 경로로 확정" flex onPress={() => navigation.navigate('ChallengeShare')} />
            </View>
          </View>
        ) : (
          <View style={{ gap: 16, flex: 1 }}>
            <View style={{ gap: 6 }}>
              <H1 size={26}>이 그림은 여기서 경로가 되기 어려워요</H1>
              <T size={13} color={C.sub} lh={1.5}>
                {s?.reason ?? (q.error as Error)?.message}
              </T>
            </View>
            {(s?.alternatives ?? ['그림을 조금 옮기거나 줄이기', '다른 지역에서 찾기', '비슷한 검증된 코스 보기']).map((a, i) => (
              <Tap key={a} onPress={() => (i === 2 ? navigation.navigate('CourseSelect') : navigation.navigate('AreaPick'))}>
                <Glass style={{ minHeight: 56, borderRadius: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <T size={15} weight="600">
                    {a}
                  </T>
                  <IcChevron size={18} color={C.ink} w={2} />
                </Glass>
              </Tap>
            ))}
          </View>
        )}
      </Glass>
    </View>
  );
}

// ---------- 13 챌린지 확정 · 공유 ----------

export function ChallengeShare({ navigation }: P<'ChallengeShare'>) {
  const qc = useQueryClient();
  const draft = useDraft();
  const crewId = useCurrentCrewId();
  const crew = useCrew(crewId);
  const me = useMe();
  const [days, setDays] = useState(7);
  const [art, setArt] = useState<'crew' | 'public' | null>(null);
  const [gps, setGps] = useState<'me' | 'crew' | null>(null);
  const [sheet, setSheet] = useState<null | 'days' | 'art' | 'gps'>(null);
  const [copied, setCopied] = useState(false);
  const suggest = useQuery({
    queryKey: ['suggest', { shapeKey: draft.shapeKey ?? undefined, customPath: draft.customPath ?? undefined, start: draft.start, km: draft.km ?? undefined }],
    queryFn: () => api<Suggestion>('/routes/suggest', { body: { shapeKey: draft.shapeKey ?? undefined, customPath: draft.customPath ?? undefined, start: draft.start, km: draft.km ?? undefined } }),
  });
  const artV = art ?? (crew.data?.artworkVisibility === 'public' ? 'public' : 'crew');
  const gpsV = gps ?? (me.data?.settings.gpsVisibility ?? 'me');
  const start = new Date();
  const end = new Date(start.getTime() + (days - 1) * 86_400_000);
  end.setHours(23, 59, 0, 0);
  const create = useAction(async () => {
    const r = await api<{ id: number }>(`/crews/${crewId}/challenges`, {
      body: {
        shapeKey: draft.shapeKey ?? undefined,
        customPath: draft.customPath ?? undefined,
        start: draft.start,
        km: draft.km ?? undefined,
        startLabel: draft.startLabel,
        areaLabel: draft.areaLabel,
        drawingMode: draft.mode,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        visibility: artV,
        gpsVisibility: gpsV,
      },
    });
    await qc.invalidateQueries({ queryKey: ['challenge'] });
    await qc.invalidateQueries({ queryKey: ['crews'] });
    navigation.reset({ index: 1, routes: [{ name: 'Tabs' }, { name: 'ChallengeJoin', params: { challengeId: r.id } }] });
  });
  const name = draft.customPath ? '직접 그린 코스' : `${shapeLabel(draft.shapeKey ?? '')} 코스`;
  return (
    <View style={{ flex: 1 }}>
      <Screen
        gap={18}
        footer={
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Tap
              label="초대 링크 복사"
              onPress={async () => {
                if (crew.data?.invite) await Clipboard.setStringAsync(`[앱 링크]/${crew.data.invite.code}`);
                setCopied(true);
              }}
            >
              <Glass style={{ width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' }}>{copied ? <IcCheck /> : <IcLink />}</Glass>
            </Tap>
            <Btn title="크루에 챌린지 공유" flex loading={create.isPending} disabled={!crewId} onPress={() => create.mutate(undefined)} />
          </View>
        }
      >
        <NavBar onBack={() => navigation.goBack()} title="챌린지 설정" step="3 / 3" />
        <Glass style={{ borderRadius: 20, padding: 12, flexDirection: 'row', gap: 14, alignItems: 'center' }}>
          <View style={{ width: 88, height: 64, borderRadius: 14, overflow: 'hidden', backgroundColor: C.map.land }}>
            {suggest.data?.route ? <RouteArt route={suggest.data.route} w={88} h={64} pad={8} mode="route" stroke={3} map={false} /> : null}
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <T size={17} weight="700">
              {name}
            </T>
            <T size={13} color={C.sub}>
              <T size={13} color={C.sub} rounded>
                {suggest.data?.distanceKm ?? '–'}km
              </T>{' '}
              · {draft.areaLabel} · 출발 {draft.startLabel}
            </T>
          </View>
        </Glass>
        <Glass style={{ borderRadius: 20 }}>
          {[
            ['기간', `${md(start)} – ${md(end)}`, 'days'],
            ['완성 작품 공개', artV === 'crew' ? '크루원만' : '모두에게', 'art'],
            ['상세 GPS 경로 공개', gpsV === 'me' ? '나만 보기' : '크루원', 'gps'],
          ].map(([l, v, k]) => (
            <Tap key={k} noScale onPress={() => setSheet(k as any)} style={{ minHeight: 52, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <T size={14} color={C.sub}>
                {l}
              </T>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <T size={14} weight="600">
                  {v}
                </T>
                <IcChevron size={16} color={C.sub} w={2} />
              </View>
            </Tap>
          ))}
        </Glass>
        <ErrorText error={create.error} />
      </Screen>
      <Sheet open={!!sheet} onClose={() => setSheet(null)}>
        <T size={20} weight="700">
          {sheet === 'days' ? '기간' : sheet === 'art' ? '완성 작품 공개' : '상세 GPS 경로 공개'}
        </T>
        <View>
          {sheet === 'days'
            ? [3, 7, 14].map((d) => <RadioRow key={d} label={`${d}일`} hint={`오늘부터 ${md(new Date(start.getTime() + (d - 1) * 86_400_000))}까지`} on={days === d} onPress={() => setDays(d)} />)
            : sheet === 'art'
              ? [
                  <RadioRow key="c" label="크루원만" hint="완성 작품을 크루 안에서만 봐요" on={artV === 'crew'} onPress={() => setArt('crew')} />,
                  <RadioRow key="p" label="모두에게" hint="갤러리와 크루 상세에 보여요 · 출발 지점은 숨겨요" on={artV === 'public'} onPress={() => setArt('public')} />,
                ]
              : [
                  <RadioRow key="m" label="나만 보기" hint="달린 길을 나만 자세히 봐요" on={gpsV === 'me'} onPress={() => setGps('me')} />,
                  <RadioRow key="c" label="크루원" hint="같은 크루원도 자세한 길을 봐요" on={gpsV === 'crew'} onPress={() => setGps('crew')} />,
                ]}
        </View>
        <Btn title="확인" kind="fill" onPress={() => setSheet(null)} />
      </Sheet>
    </View>
  );
}

// ---------- 13-1 친구와 달리기 ----------

const FRIEND_LINK = (code: string) => `https://example.com/f/${code}`; // 실제 앱 링크는 아직 미정(기획서)

export function FriendRun({ navigation }: P<'FriendRun'>) {
  const [mode, setMode] = useState<'make' | 'join'>('make');
  const [step, setStep] = useState(1);
  const [shape, setShape] = useState('heart');
  const [period, setPeriod] = useState<'오늘' | '3일' | '7일'>('3일');
  const [sheet, setSheet] = useState(false);
  const [here, setHere] = useState<LatLng | null>(null);
  const [made, setMade] = useState<{ id: number; code: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [code, setCode] = useState('');
  const shapes = useQuery({ queryKey: ['shapes'], queryFn: () => api<ShapeInfo[]>('/shapes') });
  const cur = shapes.data?.find((s) => s.key === shape);

  useEffect(() => {
    if (step !== 2 || here) return;
    // 출발 지점은 지금 위치 근처. 위치를 못 받으면 성수역 근처로
    Location.getForegroundPermissionsAsync()
      .then((p) => (p.granted ? Location.getCurrentPositionAsync({}) : null))
      .then((l) => setHere(l ? [l.coords.latitude, l.coords.longitude] : START_SPOTS[0].pos))
      .catch(() => setHere(START_SPOTS[0].pos));
  }, [step, here]);
  const preview = useQuery({
    queryKey: ['suggest', shape, here],
    queryFn: () => api<Suggestion>('/routes/suggest', { body: { shapeKey: shape, start: here } }),
    enabled: step >= 2 && !!here,
  });
  const join = useQuery({ queryKey: ['friend', code], queryFn: () => api(`/friend-challenges/${code}`), enabled: code.length === 6, retry: false });
  const make = useAction(async () => {
    const r = await api<{ id: number; code: string }>('/friend-challenges', { body: { shapeKey: shape, period, start: here } });
    setMade(r);
    setStep(3);
  });
  const doJoin = useAction(async () => {
    const r = await api<{ id: number }>(`/friend-challenges/${code}/join`, { body: {} });
    navigation.replace('Running', { challengeId: r.id });
  });

  const quick = ['heart', 'star', 'whale'];
  if (!quick.includes(shape)) quick[2] = shape;
  const summary = `${shapeLabel(shape)} · ${period} · 약 ${preview.data?.distanceKm ?? cur?.km ?? '–'}km`;
  const T1: Record<number, [string, string]> = {
    1: ['친구와 달리기', '크루 없이도 코드 하나로 함께 그림을 그려요.'],
    2: ['이 길로 달릴까요?', `${shapeLabel(shape)} 모양으로 달릴 수 있는 길을 찾았어요.`],
    3: ['코드를 보내요', '친구가 코드를 넣으면 같은 그림을 함께 채워요.'],
  };
  const [title, sub] = mode === 'make' ? T1[step] : ['친구와 달리기', '친구에게 받은 코드로 들어가요.'];

  let cta: React.ReactNode;
  if (mode === 'join') cta = <Btn title={join.data ? '참여하고 바로 달리기' : '코드를 넣어 주세요'} disabled={!join.data} loading={doJoin.isPending} onPress={() => doJoin.mutate(undefined)} />;
  else if (step === 1) cta = <Btn title="경로 찾기" onPress={() => setStep(2)} />;
  else if (step === 2) cta = <Btn title="이 경로로 코드 만들기" disabled={!preview.data?.ok} loading={make.isPending} onPress={() => make.mutate(undefined)} />;
  else
    cta = (
      <Btn
        title={copied ? '보냈어요 · 친구를 기다리는 중' : '친구에게 코드 보내기'}
        onPress={async () => {
          if (made) await Clipboard.setStringAsync(`트래비티에서 함께 그림 그리러 가요! 코드 ${made.code} · ${FRIEND_LINK(made.code)}`);
          setCopied(true);
        }}
      />
    );

  return (
    <View style={{ flex: 1 }}>
      <Screen gap={14} footer={cta}>
        <NavBar onBack={() => (mode === 'make' && step > 1 ? (setStep(step - 1), setCopied(false)) : navigation.goBack())} />
        <View style={{ gap: 6 }}>
          <H1>{title}</H1>
          <Sub>{sub}</Sub>
        </View>
        {step === 1 ? (
          <Segmented
            items={[
              { key: 'make', label: '코드 만들기' },
              { key: 'join', label: '코드로 참여' },
            ]}
            value={mode}
            onChange={setMode}
          />
        ) : null}
        {mode === 'make' && step === 1 ? (
          <View style={{ gap: 16 }}>
            <View style={{ gap: 8 }}>
              <T size={13} weight="600">
                그릴 그림
              </T>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {quick.map((k) => (
                  <Chip key={k} label={shapeLabel(k)} on={k === shape} onPress={() => setShape(k)} />
                ))}
                <TextLink title="더 고르기" onPress={() => setSheet(true)} style={{ minHeight: 36, paddingHorizontal: 12 }} />
              </View>
            </View>
            <View style={{ gap: 8 }}>
              <T size={13} weight="600">
                기간
              </T>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {(['오늘', '3일', '7일'] as const).map((p) => (
                  <Chip key={p} label={p} on={p === period} onPress={() => setPeriod(p)} style={{ flex: 1 }} />
                ))}
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, backgroundColor: C.soft, paddingVertical: 10, paddingHorizontal: 14 }}>
              <ShapeGlyph shape={shape} w={40} h={32} />
              <T size={14} color={C.body2}>
                {summary}
              </T>
            </View>
          </View>
        ) : null}
        {mode === 'make' && step === 2 ? (
          <View style={{ gap: 14 }}>
            <View style={{ height: 230, borderRadius: 20, overflow: 'hidden' }}>
              <Measure height={230}>{(w) => (preview.data?.route ? <RouteArt route={preview.data.route} w={w} h={230} pad={30} mode="route" stroke={5} showStart /> : <Loading />)}</Measure>
              <Glass style={{ position: 'absolute', left: 12, top: 12, height: 30, paddingHorizontal: 12, borderRadius: 15, justifyContent: 'center', backgroundColor: 'rgba(255, 255, 255, 0.7)' }}>
                <T size={12} weight="600">
                  지금 위치 근처
                </T>
              </Glass>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <StatCard radius={16} label="예상 거리" value={String(preview.data?.distanceKm ?? '–')} unit=" km" />
              <StatCard radius={16} label="난이도" value={preview.data?.difficulty ?? '–'} plain />
            </View>
            <ErrorText error={make.error} />
          </View>
        ) : null}
        {mode === 'make' && step === 3 && made ? (
          <View style={{ gap: 14 }}>
            <Glass style={{ borderRadius: 20, paddingVertical: 18, paddingHorizontal: 16, alignItems: 'center', gap: 4 }}>
              <View style={{ width: 136, height: 136, borderRadius: 18, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08), 0 6px 18px rgba(0, 0, 0, 0.08)' }}>
                <QR text={FRIEND_LINK(made.code)} size={120} />
              </View>
              <T size={13} weight="600" color={C.sub} style={{ marginTop: 6 }}>
                QR을 찍거나 코드를 넣어요
              </T>
              <T size={34} weight="700" rounded ls={0.18}>
                {made.code.slice(0, 3)} {made.code.slice(3)}
              </T>
              <T size={13} color={C.sub}>
                {summary}
              </T>
              <T size={13} color={C.sub} style={{ marginTop: 6 }}>
                나 혼자 · 최대 6명
              </T>
            </Glass>
            <Btn
              title={copied ? '복사했어요' : '코드 복사'}
              kind="secondary"
              height={44}
              textSize={15}
              onPress={async () => {
                await Clipboard.setStringAsync(made.code);
                setCopied(true);
              }}
            />
            <Tap noScale onPress={() => navigation.navigate('FriendToCrew', { challengeId: made.id })}>
              <T size={12} color={C.sub} lh={1.5}>
                친구 챌린지는 크루 랭킹과 레벨에는 들어가지 않아요. 완성하면 이 멤버로 크루를 만들 수 있어요.{' '}
                <T size={12} weight="600" color={C.limeText}>
                  완성 화면 보기
                </T>
              </T>
            </Tap>
          </View>
        ) : null}
        {mode === 'join' ? (
          <View style={{ gap: 14 }}>
            <View style={{ gap: 8 }}>
              <T size={13} weight="600">
                친구에게 받은 코드 6자리
              </T>
              <CodeCells value={code} onChange={setCode} label="친구 코드 6자리 숫자" />
            </View>
            {join.data ? (
              <Glass style={{ borderRadius: 20, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <ShapeGlyph shape={join.data.shapeKey} w={56} h={44} bg={C.map.land} radius={12} />
                <View style={{ gap: 2 }}>
                  <T size={15} weight="600">
                    {join.data.title}
                  </T>
                  <T size={12} color={C.sub}>
                    {join.data.joined}명 참여 · {join.data.daysLeft}일 남음 · {join.data.distanceKm}km
                  </T>
                </View>
              </Glass>
            ) : join.error ? (
              <T size={13} color={C.danger}>
                {(join.error as Error).message}
              </T>
            ) : null}
            <ErrorText error={doJoin.error} />
          </View>
        ) : null}
      </Screen>
      <Sheet open={sheet} onClose={() => setSheet(false)}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <T size={20} weight="700">
            그림 고르기
          </T>
          <Btn title="닫기" kind="secondary" height={36} textSize={14} onPress={() => setSheet(false)} />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {FRIEND_SHAPES.map((k) => (
            <Tap
              key={k}
              onPress={() => {
                setShape(k);
                setSheet(false);
              }}
              style={{ width: '22.5%', flexGrow: 1, height: 84, borderRadius: 16, paddingVertical: 8, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'space-between', backgroundColor: k === shape ? 'rgba(163, 230, 53, 0.45)' : C.field }}
            >
              <ShapeGlyph shape={k} w="100%" h={40} />
              <T size={12} weight="600">
                {shapeLabel(k)}
              </T>
            </Tap>
          ))}
        </View>
        <T size={12} color={C.sub}>
          직접 그리기는 크루 챌린지에서만 할 수 있어요.
        </T>
      </Sheet>
    </View>
  );
}

// ---------- 13-2 친구 챌린지 완성 · 크루로 만들기 ----------

export function FriendToCrew({ navigation, route }: P<'FriendToCrew'>) {
  const qc = useQueryClient();
  const setAuth = useAuth((s) => s.set);
  const ch = useChallenge(route.params.challengeId);
  const [name, setName] = useState('');
  const make = useAction(async () => {
    const r = await api<{ crewId: number }>(`/challenges/${route.params.challengeId}/to-crew`, { body: { name } });
    setAuth({ crewId: r.crewId });
    await qc.invalidateQueries({ queryKey: ['crews'] });
    navigation.reset({ index: 0, routes: [{ name: 'Tabs' }] });
  });
  if (!ch.data) return <Loading />;
  const c = ch.data;
  const people = c.members;
  const count = ['', '혼자', '둘이서', '셋이서', '넷이서', '다섯이서', '여섯이서'][people.length] ?? `${people.length}명이`;
  return (
    <Screen
      gap={18}
      footer={
        <>
          <Btn title="이 멤버로 크루 만들기" disabled={!name.trim()} loading={make.isPending} onPress={() => make.mutate(undefined)} />
          <Btn title="이번엔 작품만 남길게요" kind="secondary" onPress={() => navigation.navigate('Tabs')} />
        </>
      }
    >
      <NavBar onBack={() => navigation.goBack()} />
      <View style={{ alignSelf: 'center', width: 200, height: 150, borderRadius: 24, overflow: 'hidden', backgroundColor: C.map.land }}>
        <RouteArt route={c.route} segments={c.segments} w={200} h={150} pad={22} stroke={5} map={false} />
      </View>
      <View style={{ gap: 6 }}>
        <H1 size={26} style={{ textAlign: 'center' }}>
          {c.progress >= 0.95 ? `${count} ${c.name}를 완성했어요` : `${count} ${c.name}를 그리고 있어요`}
        </H1>
        <T size={15} color={C.sub} lh={1.5} center>
          이 멤버로 크루를 만들면 이 작품과 경험치가 크루에 담기고, 다음 랭킹부터 함께 올라가요.
        </T>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
        {people.map((p, i) => (
          <Avatar key={p.id} letter={p.name.slice(0, 1)} color={p.color} size={52} style={{ marginLeft: i ? -10 : 0, boxShadow: '0 0 0 3px #FFFFFF' }} />
        ))}
      </View>
      <View style={{ gap: 6 }}>
        <Field label="크루 이름" value={name} onChangeText={(t) => setName(t.slice(0, 16))} />
        <T size={13} color={C.sub}>
          친구들에게 초대가 가고, 수락한 사람만 크루원이 돼요.
        </T>
      </View>
      <ErrorText error={make.error} />
    </Screen>
  );
}
