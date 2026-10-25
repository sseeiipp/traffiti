import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { api } from '../api/client';
import { monthKey, useAction, useMe, useRun, useRunsMonth, useUnit } from '../api/hooks';
import { RouteArt, ShapeGlyph, type LatLng } from '../map/MapArt';
import type { P, Stack, Tabs } from '../navigation/types';
import { C } from '../theme';
import { IcBack, IcChevron, IcLock, IcTrash } from '../ui/icons';
import { Btn, ErrorText, Glass, Loading, RoundBtn, Screen, Sheet, T, TabPage, Tap } from '../ui/kit';
import { clock, fmtKm, hm, kmParts, Measure, mdw, pace, pct } from './common';

type CalProps = CompositeScreenProps<BottomTabScreenProps<Tabs, 'Calendar'>, NativeStackScreenProps<Stack>>;

// ---------- 러닝 기록 삭제 ----------

/** 러닝 기록을 지울지 묻는 시트. 진행 중인 챌린지에 반영된 러닝이면 채운 구간도 함께 빠진다고 알려 준다 */
function RunDeleteSheet({
  run,
  onClose,
  onDeleted,
}: {
  run: { id: number; title: string; isChallenge: boolean } | null;
  onClose: () => void;
  onDeleted?: () => void;
}) {
  const qc = useQueryClient();
  const del = useAction(async (id: number) => {
    await api(`/runs/${id}`, { method: 'DELETE' });
    await Promise.all(['runs', 'challenge', 'crews', 'crew', 'artworks', 'rankings'].map((k) => qc.invalidateQueries({ queryKey: [k] })));
  });
  return (
    <Sheet open={!!run} onClose={onClose}>
      {run ? (
        <View style={{ gap: 14 }}>
          <T size={20} weight="700">
            이 러닝 기록을 지울까요?
          </T>
          <T size={14} color={C.body2} lh={1.5}>
            {run.title} 기록과 GPS 경로가 모두 지워지고 되돌릴 수 없어요.
            {run.isChallenge ? ' 진행 중인 챌린지라면 이 러닝으로 채운 구간과 거리 경험치도 함께 빠져요. 이미 완성한 작품의 그림은 그대로 남아요.' : ''}
          </T>
          <Btn
            title="기록 지우기"
            kind="danger"
            loading={del.isPending}
            onPress={() =>
              del.mutate(run.id, {
                onSuccess: () => {
                  onClose();
                  onDeleted?.();
                },
              })
            }
          />
          <Btn title="취소" kind="secondary" onPress={onClose} />
          <ErrorText error={del.error} />
        </View>
      ) : null}
    </Sheet>
  );
}

// ---------- 24 달력 · 날짜별 러닝 ----------

export function Calendar({ navigation }: CalProps) {
  const unit = useUnit();
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [sel, setSel] = useState(today.getDate());
  const [toDelete, setToDelete] = useState<{ id: number; title: string; isChallenge: boolean } | null>(null);
  const runs = useRunsMonth(monthKey(cursor));
  const y = cursor.getFullYear();
  const m = cursor.getMonth();
  const first = new Date(y, m, 1).getDay();
  const days = new Date(y, m + 1, 0).getDate();
  const byDay = new Map<number, NonNullable<typeof runs.data>>();
  for (const r of runs.data ?? []) {
    const d = new Date(r.startedAt).getDate();
    byDay.set(d, [...(byDay.get(d) ?? []), r]);
  }
  const list = byDay.get(sel) ?? [];
  const isToday = (d: number) => y === today.getFullYear() && m === today.getMonth() && d === today.getDate();
  const move = (k: number) => {
    setCursor(new Date(y, m + k, 1));
    setSel(1);
  };
  return (
    <TabPage
      gap={14}
      header={
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <T size={32} weight="700" ls={-0.025}>
            달력
          </T>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
            <Tap noScale label="이전 달" onPress={() => move(-1)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
              <IcBack size={20} />
            </Tap>
            <T size={15} weight="600">
              {y}년 {m + 1}월
            </T>
            <Tap noScale label="다음 달" onPress={() => move(1)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
              <IcChevron size={20} color={C.ink} w={2} />
            </Tap>
          </View>
        </View>
      }
    >
      <Glass style={{ borderRadius: 20, paddingTop: 12, paddingHorizontal: 10, paddingBottom: 10, gap: 4 }}>
        <View style={{ flexDirection: 'row', paddingBottom: 4 }}>
          {['일', '월', '화', '수', '목', '금', '토'].map((d) => (
            <T key={d} size={12} color={C.sub} center style={{ flex: 1 }}>
              {d}
            </T>
          ))}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 2 }}>
          {Array.from({ length: first }, (_, i) => (
            <View key={`e${i}`} style={{ width: `${100 / 7}%`, height: 46 }} />
          ))}
          {Array.from({ length: days }, (_, i) => {
            const d = i + 1;
            const on = d === sel;
            const rs = byDay.get(d);
            const kind = rs ? (rs.some((r) => r.isChallenge) ? 'c' : 'p') : null;
            return (
              <Pressable
                key={d}
                accessibilityLabel={`${m + 1}월 ${d}일${kind ? ', 러닝 기록 있음' : ''}`}
                onPress={() => setSel(d)}
                // 안드로이드 터치 효과가 칸 전체를 네모로 칠하지 않게 끄고, 누르는 동안 날짜 원을 연두색으로 칠한다
                android_ripple={{ color: 'transparent' }}
                style={{ width: `${100 / 7}%`, height: 46, alignItems: 'center', justifyContent: 'center', gap: 3 }}
              >
                {({ pressed }) => (
                  <>
                    {/* 기기마다 View의 둥근 모서리가 네모로 보이는 경우가 있어 원은 SVG로 그린다 */}
                    <View style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
                      {on || pressed || isToday(d) ? (
                        <Svg width={32} height={32} style={{ position: 'absolute' }}>
                          <Circle cx={16} cy={16} r={on || pressed ? 16 : 15} fill={on ? C.lime : pressed ? C.limeSoft : 'none'} stroke={on || pressed ? 'none' : C.lime} strokeWidth={1.5} />
                        </Svg>
                      ) : null}
                      <T size={14} weight={on ? '700' : '500'} rounded>
                        {d}
                      </T>
                    </View>
                    <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: kind === 'c' ? '#7A5AF8' : kind === 'p' ? C.sub3 : 'transparent' }} />
                  </>
                )}
              </Pressable>
            );
          })}
        </View>
        <View style={{ flexDirection: 'row', gap: 14, paddingTop: 6, paddingHorizontal: 6 }}>
          {[
            ['#7A5AF8', '챌린지 러닝'],
            [C.sub3, '개인 러닝'],
          ].map(([c, l]) => (
            <View key={l} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c }} />
              <T size={12} color={C.sub}>
                {l}
              </T>
            </View>
          ))}
        </View>
      </Glass>
      <View style={{ gap: 8 }}>
        <T size={15} weight="700">
          {mdw(new Date(y, m, sel))}
        </T>
        {runs.isLoading ? null : list.length ? (
          list.map((r) => (
            <Tap key={r.id} onPress={() => navigation.navigate('RunDetail', { runId: r.id })}>
              <Glass style={{ minHeight: 64, borderRadius: 20, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 4, height: 36, borderRadius: 2, backgroundColor: r.isChallenge ? '#7A5AF8' : C.sub3 }} />
                <View style={{ flex: 1, gap: 2 }}>
                  <T size={14} weight="600" numberOfLines={1}>
                    {r.title}
                  </T>
                  <T size={12} color={C.sub}>
                    {hm(r.startedAt)} · {clock(r.durationS)}
                  </T>
                </View>
                <T size={16} weight="600" rounded>
                  {fmtKm(r.distanceKm, unit, 2)}
                </T>
                <Tap
                  noScale
                  label="이 러닝 기록 지우기"
                  onPress={() => setToDelete({ id: r.id, title: r.title, isChallenge: r.isChallenge })}
                  style={{ width: 36, height: 44, marginRight: -8, alignItems: 'center', justifyContent: 'center' }}
                >
                  <IcTrash size={18} color={C.sub2} />
                </Tap>
              </Glass>
            </Tap>
          ))
        ) : (
          <Glass style={{ borderRadius: 20, paddingVertical: 18, paddingHorizontal: 16 }}>
            <T size={14} color={C.sub}>
              이 날은 러닝 기록이 없어요.
            </T>
          </Glass>
        )}
      </View>
      <RunDeleteSheet run={toDelete} onClose={() => setToDelete(null)} />
    </TabPage>
  );
}

// ---------- 25 러닝 기록 상세 ----------

export function RunDetail({ navigation, route }: P<'RunDetail'>) {
  const unit = useUnit();
  const run = useRun(route.params.runId);
  const me = useMe();
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState(false);
  if (!run.data) return <Loading />;
  const r = run.data;
  const trail = r.points as LatLng[];
  const base = r.route ?? trail;
  const c = r.challenge;
  return (
    <Screen gap={16}>
      <View style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <RoundBtn onPress={() => navigation.goBack()} />
        <View>
          <T size={26} weight="700" ls={-0.02}>
            {mdw(r.startedAt)}
          </T>
          <T size={12} color={C.sub}>
            {hm(r.startedAt)}
            {r.endedAt ? ` – ${hm(r.endedAt).replace(/오전 |오후 /, '')}` : ''}
          </T>
        </View>
        <RoundBtn kind="custom" label="이 러닝 기록 지우기" onPress={() => setConfirm(true)} style={{ marginLeft: 'auto' }}>
          <IcTrash size={20} />
        </RoundBtn>
      </View>
      <View style={{ height: 250, borderRadius: 20, overflow: 'hidden' }}>
        <Measure height={250}>
          {(w) =>
            base.length > 1 ? (
              <RouteArt
                route={base}
                w={w}
                h={250}
                pad={26}
                mode={r.route ? 'faded' : 'route'}
                segments={r.route ? base.slice(1).map(() => C.ink) : undefined}
                stroke={3}
                trail={trail.length > 1 ? { points: trail, color: '#7A5AF8' } : null}
              />
            ) : (
              <View style={{ flex: 1, backgroundColor: C.map.land }} />
            )
          }
        </Measure>
        <Glass style={{ position: 'absolute', right: 12, top: 12, height: 28, paddingHorizontal: 10, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <IcLock />
          <T size={12} weight="500">
            {me.data?.settings.gpsVisibility === 'crew' ? '크루원까지' : '나만 보기'}
          </T>
        </Glass>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {[
          ['거리', ...kmParts(r.distanceKm, unit, 2)],
          ['시간', clock(r.durationS), ''],
          ['평균 페이스', pace(r.paceS), ''],
          ['기록 공백', r.gapCount ? `${r.gapCount}곳 · ${Math.round(r.gapSeconds / 60)}분` : '없음', ''],
        ].map(([l, v, u], i) => (
          <Glass key={l} style={{ width: '48%', flexGrow: 1, borderRadius: 20, padding: 14, gap: 4 }}>
            <T size={12} color={C.sub}>
              {l}
            </T>
            <T size={i === 3 ? 20 : 24} weight="700" rounded={i < 3}>
              {v}
              <T size={14} weight="700" rounded>
                {u}
              </T>
            </T>
          </Glass>
        ))}
      </View>
      {c ? (
        <Tap onPress={() => navigation.navigate('ChallengeJoin', { challengeId: c.id })}>
          <Glass kind="lime" style={{ minHeight: 68, borderRadius: 18, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <ShapeGlyph shape={c.shapeKey} path={c.customPath} route={r.route} w={40} h={26} sw={16} />
            <View style={{ flex: 1, gap: 2 }}>
              <T size={15} weight="600">
                {c.title}
              </T>
              <T size={12} color={C.limeDeep}>
                {c.segmentLabel ? `${c.segmentLabel} 구간에 반영 · ` : ''}
                {c.isFriend ? '함께 그린 정도' : '크루 진행률'} {pct(c.currentProgress)}
              </T>
            </View>
            <IcChevron size={16} color={C.ink} w={2} />
          </Glass>
        </Tap>
      ) : (
        <T size={13} color={C.sub} lh={1.5}>
          개인 러닝이라 크루 작품과 랭킹에는 들어가지 않았어요.
        </T>
      )}
      <RunDeleteSheet
        run={confirm ? { id: r.id, title: c ? c.title : '개인 러닝', isChallenge: !!c } : null}
        onClose={() => setConfirm(false)}
        onDeleted={() => {
          navigation.goBack();
          qc.removeQueries({ queryKey: ['run', r.id] });
        }}
      />
    </Screen>
  );
}
