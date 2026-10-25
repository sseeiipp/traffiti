import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { useRef, useState, type ComponentRef } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, TextInput, View, Platform } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';
import { api } from '../api/client';
import {
  monthKey,
  useAction,
  useArtworks,
  useChallenge,
  useCollection,
  useCrew,
  useCurrentChallenge,
  useCurrentCrewId,
  useMe,
  useMyCrews,
  useRankings,
  useUnit,
  type Challenge,
} from '../api/hooks';
import { RouteArt, ShapeGlyph } from '../map/MapArt';
import { SHAPE_ICONS } from '../map/shapes';
import type { P, Stack, Tabs } from '../navigation/types';
import { C, font, shadow } from '../theme';
import { IcChevron, IcClear, IcDown, IcDownload, IcLink, IcMore, IcSearch, IcShare } from '../ui/icons';
import {
  Avatar,
  Btn,
  CrewAvatar,
  ErrorText,
  Glass,
  H1,
  Handle,
  Loading,
  NavBar,
  Pill,
  RoundBtn,
  Screen,
  Segmented,
  Sheet,
  Sub,
  T,
  TabPage,
  Tap,
  Toggle,
  useBottom,
  useWide,
} from '../ui/kit';
import { fmtKm, kmParts, md, Measure, pct, ymd } from './common';
import { CourseMenu } from './courseMenu';
import { CrewPickSheet } from './home';

type TabP<K extends keyof Tabs> = CompositeScreenProps<BottomTabScreenProps<Tabs, K>, NativeStackScreenProps<Stack>>;

const josa = (word: string, a: string, b: string) => {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  return word + (code >= 0 && code % 28 ? a : b);
};

// ---------- 22 갤러리 ----------

export function Gallery({ navigation }: TabP<'Gallery'>) {
  const wide = useWide();
  const crewId = useCurrentCrewId();
  const [view, setView] = useState<'all' | 'crew' | 'mine'>('all');
  const works = useArtworks(view, crewId);
  const book = useCollection(crewId);
  return (
    <TabPage
      single
      header={
        <View style={{ gap: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <H1>갤러리</H1>
            <Tap onPress={() => navigation.navigate('ShapeBook')}>
              <Glass style={{ height: 36, paddingLeft: 14, paddingRight: 10, borderRadius: 18, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <T size={14} weight="600">
                  그림 도감{' '}
                  <T size={14} weight="600" color={C.limeText} rounded>
                    {book.data ? `${book.data.got}/${book.data.total}` : ''}
                  </T>
                </T>
                <IcChevron size={12} w={3} />
              </Glass>
            </Tap>
          </View>
          <Segmented
            small
            items={[
              { key: 'all', label: '전체' },
              { key: 'crew', label: '우리 크루' },
              { key: 'mine', label: '내가 그린' },
            ]}
            value={view}
            onChange={setView}
          />
        </View>
      }
    >
      {works.isLoading ? <View style={{ height: 200 }} /> : null}
      {works.data?.length === 0 ? (
        <Glass style={{ borderRadius: 20, padding: 18 }}>
          <T size={14} color={C.sub}>
            {view === 'mine' ? '내가 구간을 채운 작품이 아직 없어요.' : '아직 작품이 없어요. 챌린지를 마치면 여기에 모여요.'}
          </T>
        </Glass>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {works.data?.map((a) => (
          <Tap
            key={a.id}
            onPress={() => navigation.navigate('Artwork', { challengeId: a.id })}
            style={{ width: wide ? '23%' : '47%', flexGrow: 1, maxWidth: wide ? '25%' : '50%' }}
          >
            <Glass style={{ borderRadius: 20, padding: 8, gap: 8 }}>
              <View style={{ height: 150, borderRadius: 14, overflow: 'hidden', backgroundColor: C.map.land }}>
                <Measure height={150}>
                  {(w) => <RouteArt route={a.route} segments={a.segments} w={w} h={150} pad={14} stroke={6} map={false} hideRemaining />}
                </Measure>
              </View>
              <View style={{ paddingHorizontal: 4, paddingBottom: 4, gap: 2 }}>
                <T size={15} weight="600" numberOfLines={1}>
                  {a.name}
                </T>
                <T size={12} color={C.sub} numberOfLines={1}>
                  {a.isOurs ? `${md(a.endedAt)} · ${a.status === 'completed' ? '완성도' : '미완료 보관'} ${pct(a.progress)}` : `${a.crewName} · 공개 작품`}
                </T>
              </View>
            </Glass>
          </Tap>
        ))}
      </View>
    </TabPage>
  );
}

// ---------- 18 진행률 · 완성도 · 협력 결과 ----------

function relayText(c: Challenge) {
  const byColor = new Map(c.contributors.map((x) => [x.color, x.name]));
  for (let i = 1; i < c.segments.length; i++) {
    const a = c.segments[i - 1];
    const b = c.segments[i];
    if (a && b && a !== b) return `${byColor.get(a)}님이 멈춘 곳에서 ${byColor.get(b)}님이 이어 달렸어요`;
  }
  return null;
}

export function CrewResult({ navigation }: TabP<'CrewResult'>) {
  const unit = useUnit();
  const crewId = useCurrentCrewId();
  const crews = useMyCrews();
  const cur = useCurrentChallenge(crewId);
  const works = useArtworks('crew', crewId);
  const lastId = cur.data?.id ?? works.data?.[0]?.id ?? null;
  const ch = useChallenge(cur.data ? null : lastId);
  const c = cur.data ?? ch.data ?? null;
  const crew = crews.data?.crews.find((x) => x.id === crewId);
  const detail = useCrew(crewId);
  const [crewSheet, setCrewSheet] = useState(false);
  if (crews.isLoading || (crew && cur.isLoading)) return <Loading />;
  // '크루 없이 하기'로 들어온 사람: 크루를 만들거나 참여하는 길만 보여준다
  if (!crew)
    return (
      <TabPage header={<H1 size={28}>크루</H1>}>
        <Glass style={{ borderRadius: 20, padding: 18, gap: 12 }}>
          <T size={17} weight="700">
            아직 크루가 없어요
          </T>
          <Sub size={14}>크루를 만들거나 초대 코드로 참여하면 크루원과 함께 그린 작품이 여기에 모여요.</Sub>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Btn title="새 크루 만들기" kind="secondary" flex textSize={15} onPress={() => navigation.navigate('CrewSetup', { mode: 'create' })} />
            <Btn title="초대 코드로 참여" flex textSize={15} onPress={() => navigation.navigate('CrewSetup', { mode: 'join' })} />
          </View>
        </Glass>
      </TabPage>
    );
  const members = detail.data?.members ?? [];
  const title = !c
    ? ''
    : c.status === 'completed'
      ? `${josa(c.name, '을', '를')} 완성했어요`
      : c.progress >= 0.85
        ? `${josa(c.name, '을', '를')} 거의 다 그렸어요`
        : `${josa(c.name, '을', '를')} 함께 그리는 중이에요`;
  const relay = c ? relayText(c) : null;
  const dash = 2 * Math.PI * 40;
  return (
    <>
    {/* 홈처럼 크루 이름 옆 ▾로 다른 크루로 바꾸거나 새 크루를 만든다 */}
    <CrewPickSheet open={crewSheet} onClose={() => setCrewSheet(false)} onSetup={(mode) => navigation.navigate('CrewSetup', { mode })} />
    <TabPage
      header={
        <Tap
          noScale
          onPress={() => setCrewSheet(true)}
          label={`크루 바꾸기, 지금 ${crew.name}`}
          style={{ alignSelf: 'flex-start', minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6 }}
        >
          <H1 size={28} style={{ flexShrink: 1 }}>
            {crew.name}
          </H1>
          <IcDown />
        </Tap>
      }
    >
      {/* 크루원: 탭을 열자마자 누가 함께하는지 먼저 보인다 */}
      <Glass style={{ borderRadius: 20, paddingTop: 14, paddingBottom: 12, gap: 10 }}>
        <Tap noScale onPress={() => navigation.navigate('CrewMembers', { crewId: crew.id })} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 6 }}>
          <T size={15} weight="700" style={{ flex: 1 }}>
            {crew.name} · 크루원 {detail.data?.memberCount ?? crew.members}명
          </T>
          <T size={13} color={C.sub}>
            전체 보기
          </T>
          <IcChevron size={16} color={C.sub} />
        </Tap>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 14 }}>
          {members.map((m) => (
            <Pressable
              key={m.id}
              accessibilityRole="link"
              disabled={m.isMe}
              onPress={() => navigation.navigate('UserProfile', { userId: m.id })}
              style={{ width: 52, alignItems: 'center', gap: 4 }}
            >
              <Avatar letter={m.name.slice(0, 1)} color={m.color} size={44} />
              <T size={12} weight={m.role === 'leader' ? '700' : '500'} numberOfLines={1}>
                {m.isMe ? '나' : m.name}
              </T>
            </Pressable>
          ))}
          <Pressable accessibilityRole="button" accessibilityLabel="크루원 초대" onPress={() => navigation.navigate('CrewInvite', { crewId: crew.id })} style={{ width: 52, alignItems: 'center', gap: 4 }}>
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.seg, alignItems: 'center', justifyContent: 'center' }}>
              <T size={22} weight="500" color={C.sub}>
                +
              </T>
            </View>
            <T size={12} color={C.sub}>
              초대
            </T>
          </Pressable>
        </ScrollView>
      </Glass>
      {c ? (
        <Glass kind="lime" style={{ borderRadius: 20, padding: 20, flexDirection: 'row', alignItems: 'center', gap: 18 }}>
          <Svg width={96} height={96} viewBox="0 0 96 96">
            <Circle cx={48} cy={48} r={40} fill="none" stroke="rgba(21, 23, 28, 0.14)" strokeWidth={10} />
            <Circle
              cx={48}
              cy={48}
              r={40}
              fill="none"
              stroke={C.ink}
              strokeWidth={10}
              strokeLinecap="round"
              strokeDasharray={`${dash * c.progress} ${dash}`}
              transform="rotate(-90 48 48)"
            />
            <SvgText x={48} y={55} textAnchor="middle" fontSize={22} fontWeight="700" fill={C.ink} fontFamily={font.rounded}>
              {pct(c.progress)}
            </SvgText>
          </Svg>
          <View style={{ flex: 1, gap: 8 }}>
            <T size={17} weight="700">
              {title}
            </T>
            <View style={{ flexDirection: 'row', gap: 14 }}>
              <T size={13} color={C.limeDeep}>
                참여{' '}
                <T size={13} weight="700" rounded>
                  {c.joined}/{c.participants}
                </T>
              </T>
              <T size={13} color={C.limeDeep}>
                이어 달리기{' '}
                <T size={13} weight="700" rounded>
                  {c.relays}
                </T>
                회
              </T>
            </View>
          </View>
        </Glass>
      ) : (
        <Glass style={{ borderRadius: 20, padding: 18, gap: 10 }}>
          <T size={17} weight="700">
            아직 결과가 없어요
          </T>
          <Sub size={14}>챌린지를 열고 달리면 크루의 완성도와 각자 그린 부분이 여기에 모여요.</Sub>
          <Btn title="새 챌린지 만들기" onPress={() => navigation.navigate('CreateMethod')} />
        </Glass>
      )}
      {c ? (
        <View style={{ gap: 10 }}>
          <T size={15} weight="700">
            각자 그린 부분
          </T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {c.contributors.map((p) => (
              <Glass key={String(p.userId)} style={{ width: '48%', flexGrow: 1, borderRadius: 20, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Avatar letter={p.name.slice(0, 1)} color={p.color} size={32} />
                <View>
                  <T size={14} weight="600">
                    {p.isMe ? `${p.name}(나)` : p.name}
                  </T>
                  <T size={12} color={C.sub}>
                    {p.part} · {fmtKm(p.km, unit)}
                  </T>
                </View>
              </Glass>
            ))}
            {c.contributors.length === 0 ? (
              <T size={13} color={C.sub}>
                아직 아무도 달리지 않았어요.
              </T>
            ) : null}
          </View>
        </View>
      ) : null}
      {c ? (
        <View style={{ gap: 10 }}>
          <T size={15} weight="700">
            함께 달린 기록
          </T>
          <Glass style={{ borderRadius: 20, paddingVertical: 4, paddingHorizontal: 16 }}>
            {relay ? (
              <View style={{ minHeight: 48, justifyContent: 'center' }}>
                <T size={14} lh={1.45}>
                  {relay}
                </T>
              </View>
            ) : null}
            <View style={{ minHeight: 48, justifyContent: 'center' }}>
              <T size={14} lh={1.45}>
                {c.joined >= c.participants ? '크루원 모두가 한 번 이상 달렸어요' : `아직 ${c.participants - c.joined}명이 달리지 않았어요`}
              </T>
            </View>
          </Glass>
        </View>
      ) : null}
      <Tap
        onPress={() => navigation.navigate('CrewRanking')}
        style={{
          minHeight: 52,
          borderRadius: 16,
          paddingHorizontal: 16,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#FFFFFF',
          boxShadow: shadow.soft,
        }}
      >
        <T size={14} weight="500">
          크루 랭킹 보기
        </T>
        <IcChevron size={18} color={C.ink} w={2} />
      </Tap>
    </TabPage>
    </>
  );
}

// ---------- 19 크루 랭킹 ----------

const TIERS: Record<string, { top: string; bot: string; edge: string; ink: string }> = {
  다이아: { top: '#E0F2FE', bot: '#7DD3FC', edge: '#0284C7', ink: '#0C4A6E' },
  골드: { top: '#FEF3C7', bot: '#FBBF24', edge: '#B45309', ink: '#713F12' },
  실버: { top: '#F8FAFC', bot: '#CBD5E1', edge: '#64748B', ink: '#334155' },
  브론즈: { top: '#FFEDD5', bot: '#FDBA74', edge: '#C2410C', ink: '#7C2D12' },
};

function TierBadge({ tier }: { tier: string }) {
  const t = TIERS[tier] ?? TIERS['브론즈'];
  return (
    <LinearGradient
      colors={[t.top, t.bot]}
      style={{ height: 24, paddingHorizontal: 9, borderRadius: 999, justifyContent: 'center', boxShadow: `inset 0 1px 0 rgba(255, 255, 255, 0.8), 0 1.5px 0 ${t.edge}` }}
    >
      <T size={11} weight="700" color={t.ink}>
        {tier}
      </T>
    </LinearGradient>
  );
}

export function CrewRanking({ navigation }: P<'CrewRanking'>) {
  const [type, setType] = useState<'completion_rate' | 'xp'>('completion_rate');
  const [period, setPeriod] = useState<'monthly' | 'all_time'>('monthly');
  // 월 선택 버튼은 없앴다(디자인 정리): 월별은 이번 달
  const month = monthKey(new Date());
  const [cat, setCat] = useState('all');
  const [menu, setMenu] = useState<'' | 'cat'>('');
  const [q, setQ] = useState('');
  const cats = useQuery({ queryKey: ['rank-cats'], queryFn: () => api<{ key: string; label: string }[]>('/rankings/categories') });
  const r = useRankings({ type, period, month: period === 'monthly' ? month : undefined, category: type === 'completion_rate' ? cat : undefined });
  const fmt = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const rows = (r.data?.rows ?? []).filter((x) => !q.trim() || x.name.includes(q.trim()));
  const catLabel = cats.data?.find((c) => c.key === cat)?.label ?? '모든 그림';
  const item = (on: boolean) => ({
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 14,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    backgroundColor: on ? 'rgba(163, 230, 53, 0.35)' : 'transparent',
  });
  return (
    <View style={{ flex: 1 }}>
      <Screen gap={10} scroll={false}>
        <View style={{ height: 44, flexDirection: 'row', alignItems: 'center', gap: 8, zIndex: 6 }}>
          <RoundBtn onPress={() => navigation.goBack()} />
          <T size={17} weight="600" center style={{ flex: 1 }}>
            크루 랭킹
          </T>
          <View style={{ width: 44 }} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, zIndex: 5 }}>
          <View style={{ flex: 1, flexDirection: 'row', gap: 20, paddingHorizontal: 2 }}>
            {(
              [
                ['completion_rate', '달성률'],
                ['xp', '경험치'],
              ] as const
            ).map(([k, l]) => (
              <Pressable
                key={k}
                accessibilityRole="tab"
                onPress={() => (setType(k), setMenu(''), k === 'xp' && setCat('all'))}
                style={{ height: 36, justifyContent: 'center', boxShadow: type === k ? `inset 0 -2.5px 0 ${C.limeEdge}` : undefined }}
              >
                <T size={16} weight={type === k ? '700' : '500'} color={type === k ? C.ink : C.sub2}>
                  {l}
                </T>
              </Pressable>
            ))}
          </View>
          {type === 'completion_rate' ? (
            <Tap
              onPress={() => setMenu(menu === 'cat' ? '' : 'cat')}
              style={{ height: 30, paddingLeft: 12, paddingRight: 10, borderRadius: 15, backgroundColor: C.fill, flexDirection: 'row', alignItems: 'center', gap: 4 }}
            >
              <T size={13} weight="600">
                {catLabel}
              </T>
              <IcDown size={12} color={C.ink} w={3} />
            </Tap>
          ) : null}
        </View>
        <Segmented
          small
          items={[
            { key: 'monthly', label: '월별' },
            { key: 'all_time', label: '전체 기간' },
          ]}
          value={period}
          onChange={(v) => (setPeriod(v), setMenu(''))}
        />
        <View style={{ height: 40, borderRadius: 12, backgroundColor: C.field, paddingLeft: 12, paddingRight: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <IcSearch />
          <TextInput
            value={q}
            onChangeText={(t) => setQ(t.slice(0, 20))}
            placeholder="크루 이름 검색"
            placeholderTextColor={C.sub3}
            accessibilityLabel="크루 이름 검색"
            style={[{ flex: 1, fontSize: 15, color: C.ink, fontFamily: font.text }, Platform.OS === 'web' && ({ outlineStyle: 'none' } as any)]}
          />
          {q ? (
            <Tap noScale label="검색어 지우기" onPress={() => setQ('')} style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}>
              <IcClear />
            </Tap>
          ) : null}
        </View>
        <ScrollView style={{ height: 520 }} contentContainerStyle={{ paddingTop: 6, paddingBottom: 140, gap: 10 }} showsVerticalScrollIndicator={false}>
          {r.isLoading ? (
            <View accessibilityLabel="랭킹 불러오는 중" style={{ gap: 14 }}>
              {[1, 2, 3, 4, 5].map((k) => (
                <View key={k} style={{ height: 60, borderRadius: 18, backgroundColor: C.field }} />
              ))}
            </View>
          ) : r.error ? (
            <View style={{ alignItems: 'center', gap: 8, paddingTop: 80 }}>
              <T size={17} weight="700">
                랭킹을 불러오지 못했어요
              </T>
              <T size={14} color={C.sub} lh={1.5} center>
                연결 상태를 확인하고 다시 시도해 주세요.
              </T>
              <Btn title="다시 시도" kind="fill" height={44} textSize={15} onPress={() => r.refetch()} />
            </View>
          ) : r.data && r.data.total === 0 ? (
            <View style={{ alignItems: 'center', gap: 8, paddingTop: 80 }}>
              <T size={17} weight="700">
                {period === 'monthly' ? `${Number(month.slice(5))}월 랭킹이 아직 없어요` : '아직 랭킹이 없어요'}
              </T>
              <T size={14} color={C.sub} lh={1.5} center>
                크루가 챌린지를 하나 마치면 순위가 생겨요.
              </T>
              <Btn title="새 챌린지 만들기" kind="fill" height={44} textSize={15} onPress={() => navigation.navigate('CreateMethod')} />
            </View>
          ) : (
            <>
              {rows.length ? (
                // 한 장의 유리 패널 안에 줄로 나열(순위는 회색 숫자, 화살표 없음)
                <Glass style={{ borderRadius: 20, paddingTop: 4, paddingBottom: 4, paddingLeft: 16, paddingRight: 8 }}>
                  {rows.map((x) => (
                    <Tap
                      key={x.crewId}
                      noScale
                      onPress={() => (x.mine ? navigation.navigate('CrewManage', { crewId: x.crewId }) : navigation.navigate('CrewProfile', { crewId: x.crewId }))}
                      style={{
                        minHeight: 64,
                        paddingRight: 8,
                        borderRadius: 14,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 10,
                        backgroundColor: x.mine ? 'rgba(163, 230, 53, 0.22)' : 'transparent',
                      }}
                    >
                      <T size={15} weight="700" rounded color={C.sub2} style={{ width: 22, textAlign: 'center' }}>
                        {x.rank}
                      </T>
                      <CrewAvatar crew={x} size={40} radius={12} />
                      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <T size={16} weight="600" numberOfLines={1} style={{ flexShrink: 1 }}>
                            {x.name}
                          </T>
                          {x.mine ? (
                            <T size={12} weight="700" color={C.limeText} numberOfLines={1} style={{ flexShrink: 0 }}>
                              우리
                            </T>
                          ) : null}
                          {x.change !== undefined && period === 'monthly' ? (
                            x.change === 'NEW' ? (
                              <Pill label="NEW" bg="rgba(163, 230, 53, 0.45)" color={C.limeText} height={16} size={10} style={{ paddingHorizontal: 5 }} />
                            ) : (
                              <T size={11} weight="700" color={x.change > 0 ? C.limeText : x.change < 0 ? C.danger : C.sub3}>
                                {x.change > 0 ? `▲ ${x.change}` : x.change < 0 ? `▼ ${-x.change}` : '–'}
                              </T>
                            )
                          ) : null}
                        </View>
                        <T size={13} color={C.sub}>
                          {x.members}명
                        </T>
                      </View>
                      {type === 'completion_rate' ? (
                        <TierBadge tier={x.tier ?? '브론즈'} />
                      ) : (
                        <Pill label={`Lv ${x.level}`} bg={C.ink} color={C.lime} height={24} style={{ paddingHorizontal: 9 }} />
                      )}
                      <T size={16} weight="700" rounded style={{ minWidth: 58, textAlign: 'right' }}>
                        {type === 'completion_rate' ? `${x.score}%` : `${fmt(x.score)} XP`}
                      </T>
                    </Tap>
                  ))}
                </Glass>
              ) : null}
              {rows.length === 0 ? (
                <T size={14} color={C.sub} center style={{ marginTop: 16 }}>
                  {q ? `'${q}'와(과) 맞는 크루가 없어요.` : '이 그림으로 순위에 오른 크루가 아직 없어요.'}
                </T>
              ) : null}
              {r.data ? (
                <T size={12} color={C.sub3} center style={{ marginTop: 6 }}>
                  하루 한 번 새벽 4시에 업데이트 · 마지막 {md(r.data.updatedAt)}
                </T>
              ) : null}
            </>
          )}
        </ScrollView>
      </Screen>
      {menu ? <Pressable style={StyleSheet.absoluteFill} onPress={() => setMenu('')} /> : null}
      {menu === 'cat' ? (
        <Glass
          kind="sheet"
          style={{ position: 'absolute', right: 20, top: 150, width: 180, padding: 6, borderRadius: 20, backgroundColor: 'rgba(255, 255, 255, 0.94)', zIndex: 10 }}
        >
          {(cats.data ?? [{ key: 'all', label: '모든 그림' }]).map((c) => (
            <Pressable key={c.key} onPress={() => (setCat(c.key), setMenu(''))} style={item(c.key === cat)}>
              <T size={15} weight={c.key === cat ? '600' : '500'}>
                {c.label}
              </T>
            </Pressable>
          ))}
        </Glass>
      ) : null}
    </View>
  );
}

// ---------- 19-1 크루 상세(다른 크루) ----------

export function CrewProfile({ navigation, route }: P<'CrewProfile'>) {
  const unit = useUnit();
  const crew = useCrew(route.params.crewId);
  const art = useRankings({ type: 'completion_rate', period: 'monthly' });
  const xp = useRankings({ type: 'xp', period: 'monthly' });
  const works = useArtworks('all');
  const [menu, setMenu] = useState(false);
  const [report, setReport] = useState(false);
  if (!crew.data) return <Loading />;
  const c = crew.data;
  const mine = (works.data ?? []).filter((w) => w.crewName === c.name);
  const ra = art.data?.rows.find((x) => x.crewId === c.id);
  const rx = xp.data?.rows.find((x) => x.crewId === c.id);
  const m = new Date().getMonth() + 1;
  return (
    <View style={{ flex: 1 }}>
      <Screen gap={14}>
        <NavBar
          onBack={() => navigation.goBack()}
          right={
            <RoundBtn kind="custom" label="더 보기" onPress={() => setMenu(!menu)}>
              <IcMore />
            </RoundBtn>
          }
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <CrewAvatar crew={c} size={64} radius={20} />
          <View style={{ flex: 1, gap: 3 }}>
            <T size={28} weight="700" ls={-0.02} numberOfLines={1}>
              {c.name}
            </T>
            <T size={14} color={C.sub}>
              {c.region} · 크루원 {c.memberCount}명 · Lv {c.level.level}
            </T>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {ra ? <Pill label={`${m}월 달성률 ${ra.rank}위`} height={30} size={13} style={{ paddingHorizontal: 12 }} /> : null}
          {rx ? <Pill label={`${m}월 경험치 ${rx.rank}위`} bg="#FFFFFF" height={30} size={13} style={{ paddingHorizontal: 12, boxShadow: shadow.soft }} /> : null}
        </View>
        {c.intro ? (
          <T size={15} color={C.body2} lh={1.45}>
            {c.intro}
          </T>
        ) : null}
        <View style={{ flexDirection: 'row', paddingVertical: 12, borderRadius: 18, backgroundColor: C.soft }}>
          {[
            [String(mine.filter((w) => w.status === 'completed').length), '', '완성 작품'],
            [...kmParts(c.monthKm ?? 0, unit, undefined, false), `${m}월 함께 달린 거리`],
            [String(Math.round(Math.max(0, ...mine.map((w) => w.progress)) * 100)), '%', '최고 달성률'],
          ].map(([v, u, l]) => (
            <View key={l} style={{ flex: 1, alignItems: 'center', gap: 1 }}>
              <T size={20} weight="700" rounded>
                {v}
                <T size={12} weight="600" rounded>
                  {u}
                </T>
              </T>
              <T size={12} color={C.sub}>
                {l}
              </T>
            </View>
          ))}
        </View>
        <View style={{ gap: 8 }}>
          <T size={17} weight="700" style={{ marginHorizontal: 2 }}>
            공개 작품
          </T>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {mine.slice(0, 3).map((w) => (
              <Glass key={w.id} style={{ flex: 1, maxWidth: '33%', borderRadius: 18, padding: 6, gap: 6 }}>
                <View style={{ height: 64, borderRadius: 14, overflow: 'hidden', backgroundColor: C.map.land }}>
                  <Measure height={64}>{(wd) => <RouteArt route={w.route} segments={w.segments} w={wd} h={64} pad={8} stroke={3} map={false} hideRemaining />}</Measure>
                </View>
                <View style={{ paddingHorizontal: 4, paddingBottom: 2 }}>
                  <T size={14} weight="600">
                    {w.name}
                  </T>
                  <T size={12} color={C.sub}>
                    {md(w.endedAt)}
                  </T>
                </View>
              </Glass>
            ))}
            {mine.length === 0 ? (
              <T size={13} color={C.sub}>
                공개한 작품이 없어요.
              </T>
            ) : null}
          </View>
        </View>
        <View style={{ gap: 4 }}>
          <T size={17} weight="700" style={{ marginHorizontal: 2, marginBottom: 4 }}>
            크루원{' '}
            <T size={17} weight="500" color={C.sub}>
              {c.memberCount}
            </T>
          </T>
          {c.members.map((p, i) => (
            <View key={i} style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Avatar letter={p.name.slice(0, 1)} color={p.color} size={36} />
              <T size={15} weight="500" style={{ flex: 1 }} numberOfLines={1}>
                {p.name}
              </T>
              <T size={13} color={C.sub}>
                {p.role === 'leader' ? '크루장 · ' : ''}
                {m}월 {fmtKm(p.monthKm, unit)}
              </T>
            </View>
          ))}
        </View>
      </Screen>
      {menu ? (
        <>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setMenu(false)} />
          <Glass kind="sheet" style={{ position: 'absolute', right: 20, top: 104, padding: 6, borderRadius: 20, backgroundColor: 'rgba(255, 255, 255, 0.94)', zIndex: 10 }}>
            <Pressable
              accessibilityRole="menuitem"
              onPress={() => {
                setMenu(false);
                setReport(true);
              }}
              style={{ minHeight: 44, paddingHorizontal: 12, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 8 }}
            >
              <IcFlag />
              <T size={15} weight="500" color={C.danger}>
                이 크루 신고하기
              </T>
            </Pressable>
          </Glass>
        </>
      ) : null}
      <ReportSheet open={report} kind="crew" id={c.id} name={c.name} onClose={() => setReport(false)} />
    </View>
  );
}

export const IcFlag = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24">
    <Path d="M5 21V4h11l-1.5 4L16 12H5" fill="none" stroke={C.danger} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const REPORT_REASONS: Record<'crew' | 'user', [string, string, string][]> = {
  crew: [
    ['photo', '크루 사진', '운영팀이 직접 확인해요'],
    ['name', '크루 이름 · 소개', '자동 검사 후 필요하면 운영팀이 봐요'],
    ['art', '공개 작품', '그림 이름이나 사진'],
    ['etc', '기타', '아래에 자세히 적어 주세요'],
  ],
  user: [
    ['name', '부적절한 이름 · 사진', '운영팀이 직접 확인해요'],
    ['abuse', '욕설 · 괴롭힘', '크루나 채팅에서 불편을 줬어요'],
    ['spam', '스팸 · 광고', '초대나 알림을 반복해서 보내요'],
    ['cheat', '기록 조작', 'GPS를 속이거나 다른 사람 기록을 썼어요'],
    ['etc', '기타', '아래에 자세히 적어 주세요'],
  ],
};

/** 크루·유저 신고. 신고한 사람은 상대에게 알려지지 않는다. 사진·이름은 사람이, 나머지는 자동 검사 후 필요하면 사람이 본다 */
export function ReportSheet({ open, kind, id, name, onClose }: { open: boolean; kind: 'crew' | 'user'; id: number; name: string; onClose: () => void }) {
  const [reason, setReason] = useState('');
  const [detail, setDetail] = useState('');
  const send = useAction(() => api(`/${kind === 'crew' ? 'crews' : 'users'}/${id}/reports`, { body: { reason, detail } }));
  const manual = kind === 'crew' ? reason === 'photo' : reason === 'name';
  const close = () => {
    onClose();
    setReason('');
    setDetail('');
    send.reset();
  };
  return (
    <Sheet open={open} onClose={close}>
      {send.isSuccess ? (
        <>
          <View style={{ alignItems: 'center', gap: 10, paddingTop: 8, paddingBottom: 4 }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#ECFCCB', alignItems: 'center', justifyContent: 'center' }}>
              <Svg width={26} height={26} viewBox="0 0 24 24">
                <Path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke={C.limeText} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </View>
            <T size={20} weight="700">
              신고했어요
            </T>
            <T size={14} color={C.body2} lh={1.55} center>
              {kind === 'user'
                ? manual
                  ? '운영팀이 직접 확인하고, 결과를 알림으로 알려드려요.'
                  : '운영팀이 내용을 확인하고, 결과를 알림으로 알려드려요. 신고한 사람은 상대에게 알려지지 않아요.'
                : manual
                  ? '운영팀이 사진을 직접 확인하고, 결과를 알림으로 알려드려요.'
                  : '먼저 자동으로 검사하고, 필요하면 운영팀이 확인해요. 결과는 알림으로 알려드려요.'}
            </T>
          </View>
          <Btn title="확인" onPress={close} />
        </>
      ) : (
        <>
          <View style={{ gap: 4 }}>
            <T size={20} weight="700">
              무엇을 신고할까요?
            </T>
            <T size={13} color={C.sub}>
              {name} · 신고한 사람은 {kind === 'crew' ? '크루' : '상대'}에게 알려지지 않아요
            </T>
          </View>
          <View accessibilityRole="radiogroup" style={{ gap: 2 }}>
            {REPORT_REASONS[kind].map(([k, l, h]) => {
              const on = reason === k;
              return (
                <Pressable
                  key={k}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  onPress={() => setReason(k)}
                  style={{
                    minHeight: 54,
                    paddingHorizontal: 14,
                    borderRadius: 14,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    backgroundColor: on ? 'rgba(217, 45, 32, 0.08)' : 'transparent',
                  }}
                >
                  <View style={{ flex: 1, gap: 1 }}>
                    <T size={15} weight="500">
                      {l}
                    </T>
                    <T size={12} color={C.sub}>
                      {h}
                    </T>
                  </View>
                  <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: on ? 7 : 2, borderColor: on ? C.danger : '#C7C7CC' }} />
                </Pressable>
              );
            })}
          </View>
          <TextInput
            value={detail}
            onChangeText={(t) => setDetail(t.slice(0, 500))}
            placeholder="자세한 내용 (선택)"
            placeholderTextColor={C.sub3}
            accessibilityLabel="자세한 내용"
            multiline
            numberOfLines={2}
            style={[
              {
                minHeight: 64,
                borderRadius: 14,
                backgroundColor: C.field,
                paddingHorizontal: 14,
                paddingVertical: 12,
                fontSize: 15,
                color: C.ink,
                fontFamily: font.text,
                textAlignVertical: 'top',
              },
              Platform.OS === 'web' && ({ outlineStyle: 'none' } as any),
            ]}
          />
          <ErrorText error={send.error} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Btn title="취소" kind="secondary" flex onPress={close} />
            <Btn title="신고하기" kind="danger" flex disabled={!reason} loading={send.isPending} onPress={() => send.mutate(undefined)} />
          </View>
        </>
      )}
    </Sheet>
  );
}

// ---------- 20 완성 작품 ----------

export function Artwork({ navigation, route }: P<'Artwork'>) {
  const unit = useUnit();
  const ch = useChallenge(route.params.challengeId);
  if (!ch.data) return <Loading />;
  const c = ch.data;
  const gapKm = Math.round(c.segments.filter((s) => !s).length * 0.02 * 10) / 10;
  const total = Math.round(c.contributors.reduce((s, x) => s + x.km, 0) * 10) / 10;
  const done = c.status === 'completed';
  return (
    <Screen
      gap={18}
      footer={
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Btn title="갤러리에 저장" flex onPress={() => navigation.navigate('Tabs', { screen: 'Gallery' } as never)} />
          <Tap label="공유" onPress={() => navigation.navigate('ShareSheet', { challengeId: c.id })}>
            <Glass style={{ width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' }}>
              <IcShare />
            </Glass>
          </Tap>
        </View>
      }
    >
      <View style={{ height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <RoundBtn kind="close" onPress={() => navigation.goBack()} />
        <T size={14} weight="600">
          {done ? '작품이 완성됐어요' : c.status === 'active' ? '그리는 중인 작품' : '미완료로 보관한 작품'}
        </T>
        <CourseMenu c={c} onDeleted={() => navigation.goBack()} />
      </View>
      <Glass style={{ borderRadius: 20, padding: 18, gap: 14 }}>
        <View style={{ height: 230, borderRadius: 14, overflow: 'hidden' }}>
          <Measure height={230}>{(w) => <RouteArt route={c.route} segments={c.segments} w={w} h={230} pad={22} stroke={7} />}</Measure>
        </View>
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <T size={26} weight="700" ls={-0.02}>
              {c.name}
            </T>
            <T size={13} weight="600" color={C.sub} rounded>
              {ymd(c.startAt)} – {ymd(c.completedAt ?? c.cancelledAt ?? c.endAt).slice(5)}
            </T>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {c.contributors.map((p) => (
              <View key={String(p.userId)} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: p.color }} />
                <T size={12} weight="500">
                  {p.name}
                </T>
              </View>
            ))}
          </View>
        </View>
      </Glass>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {[
          ['완성도', String(Math.round(c.progress * 100)), '%'],
          ['함께 달린 거리', ...kmParts(total, unit)],
          ['참여', String(c.contributors.length), ' 명'],
        ].map(([l, v, u]) => (
          <View key={l} style={{ flex: 1, gap: 2 }}>
            <T size={12} color={C.sub}>
              {l}
            </T>
            <T size={26} weight="700" rounded>
              {v}
              <T size={14} weight="700" rounded>
                {u}
              </T>
            </T>
          </View>
        ))}
      </View>
      {gapKm > 0 ? (
        <T size={13} color={C.sub} lh={1.5}>
          {done ? `GPS가 끊기거나 채우지 못한 ${fmtKm(gapKm, unit)}는 점선으로 남겼어요.` : `아직 채우지 못한 ${fmtKm(gapKm, unit)}는 점선으로 남겼어요.`}
        </T>
      ) : null}
    </Screen>
  );
}

// ---------- 21 작품 공유 ----------

export function ShareSheet({ navigation, route }: P<'ShareSheet'>) {
  const b = useBottom();
  const ch = useChallenge(route.params.challengeId);
  const me = useMe();
  const [t, setT] = useState<Record<string, boolean> | null>(null);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<'save' | 'share' | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const card = useRef<ComponentRef<typeof View>>(null);
  if (!ch.data || !me.data) return <Loading />;
  // 미리보기 카드를 그대로 PNG로 찍는다(웹은 지원하지 않아 글로만 공유)
  // view-shot 타입이 RN 0.88의 ReactNativeElement를 아직 모른다
  const snap = () => captureRef(card as unknown as Parameters<typeof captureRef>[0], { format: 'png', quality: 1, result: 'tmpfile' });
  const saveImage = async () => {
    setErr(null);
    setBusy('save');
    try {
      const perm = await MediaLibrary.requestPermissionsAsync(true);
      if (!perm.granted) throw new Error('사진 저장 권한을 허용해 주세요.');
      await MediaLibrary.saveToLibraryAsync(await snap());
      setSaved(true);
    } catch (e) {
      setErr((e as Error).message || '이미지를 저장하지 못했어요.');
    } finally {
      setBusy(null);
    }
  };
  const shareImage = async () => {
    setErr(null);
    const text = `${c.name} · ${caption}\n${link}`;
    if (Platform.OS === 'web' || !(await Sharing.isAvailableAsync())) return Share.share({ message: text }).catch(() => {});
    setBusy('share');
    try {
      await Sharing.shareAsync(await snap(), { mimeType: 'image/png', dialogTitle: c.name, UTI: 'public.png' });
    } catch {
      await Share.share({ message: text }).catch(() => {});
    } finally {
      setBusy(null);
    }
  };
  const s = t ?? { map: true, names: true, date: true, exact: !me.data.settings.hideStartOnShare };
  const c = ch.data;
  const parts: string[] = [];
  if (s.date) parts.push(`${c.crewName ?? '친구 챌린지'} · ${ymd(c.startAt)} – ${ymd(c.completedAt ?? c.endAt).slice(5)}`);
  if (s.names) parts.push(c.contributors.map((x) => x.name).join(' · '));
  if (s.exact) parts.push(`${c.startLabel} 출발`);
  const caption = parts.length ? parts.join(' · ') : '트래피티로 함께 그린 작품';
  const link = `https://example.com/a/${c.id}`; // 앱 링크 미정(기획서)
  const defs: [string, string, string][] = [
    ['map', '지도 배경', '도로 모양만, 지명 없이'],
    ['names', '크루원 이름', '색깔별 참여자 표시'],
    ['date', '날짜와 크루 이름', '작품 아래에 표시'],
    ['exact', '정확한 위치', '출발 지점과 도로명'],
  ];
  return (
    <View style={{ flex: 1, backgroundColor: 'rgba(21, 23, 28, 0.25)' }}>
      <Glass
        kind="sheet"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 72,
          bottom: 0,
          borderRadius: 0,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          paddingTop: 10,
          paddingHorizontal: 20,
          paddingBottom: b,
          gap: 16,
        }}
      >
        <Handle />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <T size={22} weight="700">
            작품 공유
          </T>
          <RoundBtn kind="close" onPress={() => navigation.goBack()} />
        </View>
        {/* 캡처할 때 유리 흐림은 찍히지 않아 흰 바탕을 따로 깐다 */}
        <View ref={card} collapsable={false} style={{ alignSelf: 'center', width: 230, borderRadius: 20, padding: 12, gap: 8, backgroundColor: '#FFFFFF', boxShadow: shadow.glass }}>
          <View style={{ borderRadius: 12, overflow: 'hidden', backgroundColor: s.map ? C.map.land : '#FFFFFF' }}>
            <RouteArt route={c.route} segments={c.segments} w={206} h={138} pad={16} stroke={6} map={s.map} svgOnly bg="#FFFFFF" hideRemaining />
          </View>
          <View style={{ gap: 2, paddingHorizontal: 2 }}>
            <T size={15} weight="700">
              {c.name}
            </T>
            <T size={11} color={C.sub}>
              {caption}
            </T>
          </View>
        </View>
        <Glass style={{ borderRadius: 20, paddingVertical: 2, paddingHorizontal: 16 }}>
          {defs.map(([k, l, h]) => (
            <View key={k} style={{ minHeight: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <View style={{ gap: 1 }}>
                <T size={14} weight="500">
                  {l}
                </T>
                <T size={12} color={C.sub}>
                  {h}
                </T>
              </View>
              <Toggle on={!!s[k]} onChange={(v) => setT({ ...s, [k]: v })} label={l} />
            </View>
          ))}
        </Glass>
        <View style={{ marginTop: 'auto', gap: 10 }}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {Platform.OS === 'web' ? null : (
              <Btn title={saved ? '저장했어요' : '이미지 저장'} kind="secondary" flex textSize={15} icon={<IcDownload />} loading={busy === 'save'} onPress={saveImage} />
            )}
            <Btn
              title={copied ? '복사했어요' : '링크 복사'}
              kind="secondary"
              flex
              textSize={15}
              icon={<IcLink size={18} w={2} />}
              onPress={async () => {
                await Clipboard.setStringAsync(link);
                setCopied(true);
              }}
            />
          </View>
          {err ? (
            <T size={13} color={C.danger} center>
              {err}
            </T>
          ) : null}
          <Btn title="다른 앱으로 공유" icon={<IcShare size={18} w={2} />} loading={busy === 'share'} onPress={shareImage} />
        </View>
      </Glass>
    </View>
  );
}

// ---------- 22-1 그림 도감 ----------

export function ShapeBook({ navigation }: P<'ShapeBook'>) {
  const crewId = useCurrentCrewId();
  const crews = useMyCrews();
  const book = useCollection(crewId);
  if (!book.data) return <Loading />;
  const name = crews.data?.crews.find((c) => c.id === crewId)?.name ?? '';
  return (
    <Screen gap={12}>
      <NavBar onBack={() => navigation.goBack()} />
      <View style={{ gap: 4 }}>
        <H1>그림 도감</H1>
        <T size={15} color={C.sub}>
          {josa(name, '이', '가')}{' '}
          <T size={15} weight="700" rounded>
            {book.data.total}
          </T>
          개 중{' '}
          <T size={15} weight="700" rounded>
            {book.data.got}
          </T>
          개를 모았어요
        </T>
      </View>
      <View style={{ height: 8, borderRadius: 4, backgroundColor: C.seg, overflow: 'hidden' }}>
        <View style={{ width: `${(book.data.got / book.data.total) * 100}%`, height: 8, borderRadius: 4, backgroundColor: C.limeEdge }} />
      </View>
      {book.data.sets.map((s) => (
        <View key={s.name} style={{ gap: 8, marginTop: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 2 }}>
            <T size={17} weight="700">
              {s.name}{' '}
              <T size={17} weight="500" color={C.sub} rounded>
                {s.got}/{s.total}
              </T>
            </T>
            <T size={12} color={C.sub}>
              {s.reward}
            </T>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {s.items.map((it) => {
              const got = it.state === 'got';
              const half = it.state === 'half';
              const sw = SHAPE_ICONS[it.key]?.sw ?? 5;
              return (
                <View
                  key={it.key}
                  style={{
                    width: '22.5%',
                    flexGrow: 1,
                    maxWidth: '25%',
                    height: 88,
                    borderRadius: 18,
                    paddingTop: 10,
                    paddingHorizontal: 6,
                    paddingBottom: 8,
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: got ? 'rgba(163, 230, 53, 0.28)' : C.soft,
                    boxShadow: got ? '0 4px 12px rgba(63, 98, 18, 0.12)' : undefined,
                    opacity: it.state === 'locked' ? 0.6 : 1,
                  }}
                >
                  <ShapeGlyph shape={it.key} w="100%" h={44} color={got ? C.limeText : half ? C.limeEdge : '#C7C7CC'} dash={got || half ? undefined : `${sw} ${sw * 1.6}`} />
                  <T size={12} weight={got ? '600' : '500'} color={got ? C.ink : half ? C.limeText : C.sub2}>
                    {it.label}
                  </T>
                </View>
              );
            })}
          </View>
        </View>
      ))}
    </Screen>
  );
}

// ---------- 23 챌린지 중단 · 미완료 보관 ----------

export function ChallengeStop({ navigation, route }: P<'ChallengeStop'>) {
  const qc = useQueryClient();
  const ch = useChallenge(route.params.challengeId);
  const stop = useAction(async () => {
    await api(`/challenges/${route.params.challengeId}/cancel`, { body: {} });
    await Promise.all(['challenge', 'artworks', 'crews', 'collection'].map((k) => qc.invalidateQueries({ queryKey: [k] })));
    navigation.reset({ index: 0, routes: [{ name: 'Tabs', params: { screen: 'Gallery' } as never }] });
  });
  if (!ch.data) return <Loading />;
  const c = ch.data;
  return (
    <View style={{ flex: 1, backgroundColor: 'rgba(21, 23, 28, 0.22)' }}>
      <Pressable style={StyleSheet.absoluteFill} onPress={() => navigation.goBack()} />
      <Glass
        kind="sheet"
        intensity={50}
        style={{
          position: 'absolute',
          left: 10,
          right: 10,
          bottom: 10,
          borderRadius: 36,
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          paddingTop: 10,
          paddingHorizontal: 20,
          paddingBottom: 24,
          gap: 18,
          boxShadow: shadow.sheet,
        }}
      >
        <Handle />
        <T size={22} weight="700" ls={-0.02}>
          {c.title}를 여기서 마칠까요?
        </T>
        <Glass style={{ borderRadius: 20, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ width: 104, height: 70, borderRadius: 14, overflow: 'hidden', backgroundColor: C.map.land }}>
            <RouteArt route={c.route} segments={c.segments} w={104} h={70} pad={8} stroke={4} map={false} />
          </View>
          <View style={{ gap: 4 }}>
            <Pill label="미완료" bg={C.seg} />
            <T size={15} weight="600">
              진행률{' '}
              <T size={15} weight="600" rounded>
                {pct(c.progress)}
              </T>
              에서 보관
            </T>
          </View>
        </Glass>
        <View style={{ gap: 8, paddingLeft: 4 }}>
          {[
            '지금까지 그린 작품과 진행률은 갤러리에 미완료 작품으로 남아요.',
            '크루원들의 러닝 기록은 각자의 달력에 그대로 있어요.',
            '중단한 챌린지는 다시 열 수 없어요. 같은 그림으로 새 챌린지는 바로 만들 수 있어요.',
          ].map((x) => (
            <T key={x} size={14} color={C.body2} lh={1.5}>
              • {x}
            </T>
          ))}
        </View>
        <View style={{ gap: 8 }}>
          <Btn title="미완료로 보관하고 마치기" loading={stop.isPending} onPress={() => stop.mutate(undefined)} />
          <Btn title="계속 진행하기" kind="secondary" onPress={() => navigation.goBack()} />
          <ErrorText error={stop.error} />
        </View>
      </Glass>
    </View>
  );
}
