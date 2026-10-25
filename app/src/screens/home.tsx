import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { api } from '../api/client';
import { useAction, useArtworks, useCurrentChallenge, useCurrentCrewId, useFriendCurrent, useMe, useMyCrews, type Challenge } from '../api/hooks';
import { RouteArt } from '../map/MapArt';
import type { P, Stack, Tabs } from '../navigation/types';
import { useAuth } from '../store/auth';
import { C } from '../theme';
import { IcCheck, IcClose, IcDown, IcPlay, IcPlus } from '../ui/icons';
import { Avatar, Btn, CrewAvatar, ErrorText, Glass, H1, Loading, NavBar, Pill, ProgressBar, Screen, Sheet, Sub, T, TabPage, Tap } from '../ui/kit';
import { md, Measure, partsOf, pct } from './common';

type HomeProps = CompositeScreenProps<BottomTabScreenProps<Tabs, 'Home'>, NativeStackScreenProps<Stack>>;

// ---------- 06 크루 홈 ----------

export function Home({ navigation }: HomeProps) {
  const crewId = useCurrentCrewId();
  const crews = useMyCrews();
  const me = useMe();
  const ch = useCurrentChallenge(crewId);
  const works = useArtworks('crew', crewId);
  const friend = useFriendCurrent();
  const setAuth = useAuth((s) => s.set);
  const [crewSheet, setCrewSheet] = useState(false);
  // 크루 이름은 화면 폭에 맞춰 22~32px(디자인 clamp(22px, 6.4vw, 32px))
  const titleSize = Math.round(Math.min(32, Math.max(22, useWindowDimensions().width * 0.064)));
  const crew = crews.data?.crews.find((c) => c.id === crewId);
  if (!crew || !crews.data) return <Loading />;
  const c = ch.data;
  const all = crews.data;
  return (
    <>
    {/* 크루 이름을 누르면 홈 위에서 바로 크루를 바꾼다(26 내 크루) */}
    <Sheet open={crewSheet} onClose={() => setCrewSheet(false)} radius={32}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 }}>
        <T size={20} weight="700" style={{ flex: 1 }}>
          내 크루
        </T>
        <Tap label="닫기" onPress={() => setCrewSheet(false)} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.fill, alignItems: 'center', justifyContent: 'center' }}>
          <IcClose size={18} />
        </Tap>
      </View>
      <View accessibilityRole="radiogroup" style={{ gap: 2 }}>
        {all.crews.map((x) => {
          const on = x.id === crew.id;
          return (
            <Pressable
              key={x.id}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              onPress={() => {
                setAuth({ crewId: x.id });
                setCrewSheet(false);
              }}
              style={{ minHeight: 64, paddingHorizontal: 10, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: on ? 'rgba(163, 230, 53, 0.22)' : 'transparent' }}
            >
              <CrewAvatar crew={x} size={44} radius={12} />
              <View style={{ flex: 1, gap: 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <T size={16} weight="600" numberOfLines={1} style={{ flexShrink: 1 }}>
                    {x.name}
                  </T>
                  {x.id === all.primaryCrewId ? <Pill label="대표" bg={C.ink} color={C.lime} height={20} /> : null}
                </View>
                <T size={13} color={C.sub}>
                  {x.members}명 · {x.activeChallenge ? `${x.activeChallenge.title} 진행 중` : '진행 중인 챌린지 없음'}
                </T>
              </View>
              {on ? <IcCheck size={20} /> : null}
            </Pressable>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Btn title="새 크루 만들기" kind="secondary" height={48} textSize={15} flex onPress={() => (setCrewSheet(false), navigation.navigate('CrewSetup', { mode: 'create' }))} />
        <Btn title="초대 코드로 참여" kind="secondary" height={48} textSize={15} flex onPress={() => (setCrewSheet(false), navigation.navigate('CrewSetup', { mode: 'join' }))} />
      </View>
    </Sheet>
    <TabPage
      gap={18}
      header={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Tap
              noScale
              onPress={() => setCrewSheet(true)}
              label={`크루 바꾸기, 지금 ${crew.name}`}
              style={{ alignSelf: 'flex-start', minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6 }}
            >
              <T size={titleSize} weight="700" ls={-0.025} numberOfLines={1} style={{ flexShrink: 1 }}>
                {crew.name}
              </T>
              <IcDown />
            </Tap>
          </View>
          <Tap onPress={() => navigation.navigate('CreateMethod')}>
            <Glass kind="lime" style={{ height: 44, borderRadius: 22, paddingLeft: 12, paddingRight: 16, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <IcPlus />
              <T size={14} weight="600">
                새 챌린지
              </T>
            </Glass>
          </Tap>
          <Tap onPress={() => navigation.navigate('MySettings')} label="내 설정">
            <Avatar letter={me.data?.name.slice(0, 1) ?? ''} color={crew.myColor} size={44} style={{ boxShadow: `0 4px 12px ${crew.myColor}4D` }} />
          </Tap>
        </View>
      }
    >
      {friend.data ? (
        <FriendCard
          c={friend.data}
          onPress={() =>
            friend.data!.timeUp
              ? navigation.navigate('FriendRunExpired', { challengeId: friend.data!.id })
              : navigation.navigate('Running', { challengeId: friend.data!.id })
          }
        />
      ) : null}
      {c ? (
        <Glass style={{ borderRadius: 20 }}>
          <Measure height={210}>{(w) => <RouteArt route={c.route} segments={c.segments} w={w} h={210} pad={28} seed={crew.id} />}</Measure>
          <Pill label={`진행 중 · ${c.daysLeft}일 남음`} height={28} size={12} style={{ position: 'absolute', left: 14, top: 14, paddingHorizontal: 10 }} />
          <View style={{ padding: 18, gap: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <T size={19} weight="700">
                {c.name} 코스
              </T>
              <T size={14} weight="600" color={C.sub} rounded>
                {c.distanceKm} km
              </T>
            </View>
            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <T size={13} color={C.sub}>
                  함께 그린 정도
                </T>
                <T size={22} weight="700" rounded>
                  {pct(c.progress)}
                </T>
              </View>
              <ProgressBar parts={partsOf(c.contributors)} />
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Btn title="러닝 시작" icon={<IcPlay />} flex onPress={() => navigation.navigate('Running', { challengeId: c.id })} />
              <Btn title="자세히" kind="secondary" style={{ width: 104 }} onPress={() => navigation.navigate('ChallengeJoin', { challengeId: c.id })} />
            </View>
          </View>
        </Glass>
      ) : ch.isLoading ? (
        <View style={{ height: 380 }} />
      ) : (
        <Glass style={{ borderRadius: 20, padding: 20, gap: 12 }}>
          <T size={19} weight="700">
            진행 중인 챌린지가 없어요
          </T>
          <Sub size={14}>크루원 누구나 새 그림을 골라 챌린지를 열 수 있어요. 기간 안에 각자 달린 기록이 모여 작품이 돼요.</Sub>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Btn title="새 챌린지 만들기" flex onPress={() => navigation.navigate('CreateMethod')} />
            <Btn title="혼자 달리기" kind="secondary" onPress={() => navigation.navigate('Running', { challengeId: null })} />
          </View>
        </Glass>
      )}

      <View style={{ gap: 12 }}>
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <T size={16} weight="700">
              지난 작품
            </T>
            <Tap noScale onPress={() => navigation.navigate('Gallery')}>
              <T size={13} weight="500" color={C.sub}>
                전체 보기
              </T>
            </Tap>
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {(works.data ?? []).slice(0, 2).map((a) => (
              <Tap key={a.id} onPress={() => navigation.navigate('Artwork', { challengeId: a.id })} style={{ flex: 1 }}>
                <Glass style={{ height: 92, borderRadius: 20, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ width: 56, height: 56, borderRadius: 14, overflow: 'hidden', backgroundColor: C.map.land }}>
                    <RouteArt route={a.route} segments={a.segments} w={56} h={56} pad={6} stroke={3} map={false} hideRemaining />
                  </View>
                  <View style={{ gap: 2, flex: 1 }}>
                    <T size={14} weight="600" numberOfLines={1}>
                      {a.name}
                    </T>
                    <T size={12} color={C.sub}>
                      {md(a.endedAt)}
                    </T>
                  </View>
                </Glass>
              </Tap>
            ))}
            {works.data && works.data.length === 0 ? (
              <T size={13} color={C.sub}>
                아직 완성한 작품이 없어요.
              </T>
            ) : null}
          </View>
        </View>
      </View>
    </TabPage>
    </>
  );
}

/** 진행 중인 친구와 달리기. 별도 탭 없이 홈 맨 위에 보인다 */
function FriendCard({ c, onPress }: { c: Challenge; onPress: () => void }) {
  const end = new Date(c.endAt);
  const today = new Date();
  // 24시에 끝나므로 끝나는 시각의 1초 전 날짜로 오늘·내일을 가른다
  const endDay = new Date(end.getTime() - 1000).toDateString();
  const when = c.timeUp ? '시간이 끝났어요' : endDay === today.toDateString() ? '오늘 24시까지' : '내일 24시까지';
  return (
    <Tap onPress={onPress} label="진행 중인 친구와 달리기">
      <View style={{ borderRadius: 20, backgroundColor: C.limeSoft, boxShadow: '0 6px 18px rgba(101, 163, 13, 0.2)', paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View style={{ width: 56, height: 56, borderRadius: 14, overflow: 'hidden', backgroundColor: '#FFFFFF' }}>
          <RouteArt route={c.route} segments={c.segments} w={56} h={56} pad={7} stroke={3.5} map={false} />
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <T size={12} weight="700" color={C.limeText}>
            친구와 달리기
          </T>
          <T size={16} weight="700" numberOfLines={1}>
            {c.name} · {pct(c.progress)}
          </T>
          <T size={13} color={C.body2}>
            {when}
          </T>
        </View>
        <View style={{ height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: C.lime, justifyContent: 'center' }}>
          <T size={14} weight="700">
            {c.timeUp ? '정하기' : '이어 달리기'}
          </T>
        </View>
      </View>
    </Tap>
  );
}

// ---------- 26 내 크루 선택 · 전환 ----------

export function CrewSwitcher({ navigation }: P<'CrewSwitcher'>) {
  const qc = useQueryClient();
  const { data } = useMyCrews();
  const current = useCurrentCrewId();
  const setAuth = useAuth((s) => s.set);
  const [sel, setSel] = useState<number | null>(current);
  const setRep = useAction((crewId: number) => api('/users/me/primary-crew', { method: 'PATCH', body: { crewId } }), [['crews']]);
  const accept = useAction((id: number) => api(`/crew-invites/${id}/accept`, { body: {} }), [['crews']]);
  if (!data) return <Loading />;
  const selected = data.crews.find((c) => c.id === sel) ?? data.crews[0];
  const rep = data.crews.find((c) => c.id === data.primaryCrewId);
  const full = data.crews.length >= data.max;
  return (
    <Screen
      gap={14}
      footer={
        <Btn
          title={selected?.id === current ? '지금 크루 그대로 보기' : `${selected?.name}로 바꾸기`}
          onPress={() => {
            setAuth({ crewId: selected?.id ?? null });
            qc.invalidateQueries({ queryKey: ['challenge'] });
            navigation.goBack();
          }}
        />
      }
    >
      <NavBar onBack={() => navigation.goBack()} kind="close" />
      <View style={{ gap: 6 }}>
        <H1>내 크루</H1>
      </View>
      <Glass style={{ borderRadius: 20, padding: 6 }}>
        {data.crews.map((c) => {
          const on = c.id === selected?.id;
          return (
            <Tap
              key={c.id}
              noScale
              onPress={() => setSel(c.id)}
              style={{
                minHeight: 68,
                paddingHorizontal: 12,
                borderRadius: 14,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                backgroundColor: on ? 'rgba(163, 230, 53, 0.22)' : 'transparent',
              }}
            >
              <CrewAvatar crew={c} size={44} radius={12} />
              <View style={{ flex: 1, gap: 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <T size={17} weight="600" numberOfLines={1} style={{ flexShrink: 1 }}>
                    {c.name}
                  </T>
                  {c.id === data.primaryCrewId ? <Pill label="대표" bg={C.ink} color={C.lime} height={20} /> : null}
                  {c.role === 'leader' ? <Pill label="크루장" bg={C.seg} height={20} /> : null}
                </View>
                <T size={13} color={C.sub}>
                  {c.members}명 · {c.activeChallenge ? `${c.activeChallenge.title} 진행 중` : '진행 중인 챌린지 없음'}
                </T>
              </View>
              {on ? <IcCheck size={20} /> : null}
            </Tap>
          );
        })}
      </Glass>
      <Glass style={{ borderRadius: 20, paddingVertical: 12, paddingLeft: 16, paddingRight: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <T size={13} color={C.sub}>
            대표 크루
          </T>
          <T size={16} weight="600">
            {rep?.name ?? '없음'}
          </T>
        </View>
        {selected && selected.id !== data.primaryCrewId ? (
          <Btn
            title="이 크루로 바꾸기"
            height={36}
            textSize={14}
            loading={setRep.isPending}
            onPress={() => setRep.mutate(selected.id)}
            style={{ backgroundColor: C.lime, boxShadow: undefined }}
          />
        ) : null}
      </Glass>
      {data.invites.length ? (
        <>
          <T size={13} weight="600" color={C.sub} style={{ marginLeft: 4, marginTop: 4 }}>
            받은 초대
          </T>
          {data.invites.map((i) => (
            <Glass key={i.id} style={{ borderRadius: 20, padding: 12, paddingLeft: 16, flexDirection: 'row', alignItems: 'center' }}>
              <T size={16} weight="600" style={{ flex: 1 }}>
                {i.name}
              </T>
              <Btn title="수락" height={36} textSize={14} onPress={() => accept.mutate(i.id)} />
            </Glass>
          ))}
        </>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Btn
          title="새 크루 만들기"
          kind="secondary"
          flex
          textSize={15}
          icon={<IcPlus size={16} w={2.4} />}
          disabled={full}
          onPress={() => navigation.navigate('CrewSetup', { mode: 'create' })}
        />
        <Btn title="초대 코드로 참여" kind="secondary" flex textSize={15} disabled={full} onPress={() => navigation.navigate('CrewSetup', { mode: 'join' })} />
      </View>
      <ErrorText error={setRep.error ?? accept.error} />
    </Screen>
  );
}
