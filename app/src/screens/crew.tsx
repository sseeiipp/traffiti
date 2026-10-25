import { useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { useEffect, useState } from 'react';
import { Pressable, Share, StyleSheet, View } from 'react-native';
import { api } from '../api/client';
import { usePhotoPicker } from '../api/photo';
import { useAction, useArtworks, useCrew, useCurrentCrewId, type CrewDetail } from '../api/hooks';
import { RouteArt, ShapeGlyph } from '../map/MapArt';
import type { P } from '../navigation/types';
import { useAuth } from '../store/auth';
import { C, shadow } from '../theme';
import { IcCamera, IcCheck, IcChevron, IcCrown, IcInvite, IcMore, IcPlus } from '../ui/icons';
import {
  Avatar,
  Btn,
  CrewAvatar,
  CrewPhoto,
  ErrorText,
  Field,
  Glass,
  Group,
  H1,
  Loading,
  NavBar,
  RadioRow,
  RoundBtn,
  Row,
  Screen,
  Sheet,
  Sub,
  T,
  Tap,
  Toggle,
  useBottom,
} from '../ui/kit';
import { md, Measure, pct } from './common';

function useCrewParam(id?: number) {
  const current = useCurrentCrewId();
  return useCrew(id ?? current);
}

// ---------- 27 크루 정보 · 관리 ----------

export function CrewManage({ navigation, route }: P<'CrewManage'>) {
  const crew = useCrewParam(route.params?.crewId);
  const works = useArtworks('crew', crew.data?.id);
  if (!crew.data) return <Loading />;
  const c = crew.data;
  const leader = c.myRole === 'leader';
  const a = c.activeChallenge;
  return (
    <Screen gap={12} bottomSpace={32}>
      <View style={{ height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <RoundBtn onPress={() => navigation.goBack()} />
        <Tap onPress={() => navigation.navigate('CrewInvite', { crewId: c.id })} label="크루 초대">
          <Glass style={{ height: 44, paddingLeft: 12, paddingRight: 16, borderRadius: 22, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <IcInvite />
            <T size={15} weight="600">
              초대
            </T>
          </Glass>
        </Tap>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View style={{ borderRadius: 20, boxShadow: '0 6px 16px rgba(0, 0, 0, 0.12)' }}>
          <CrewAvatar crew={c} size={64} radius={20} />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <T size={28} weight="700" ls={-0.02} numberOfLines={1}>
            {c.name}
          </T>
          <T size={14} color={C.sub}>
            {c.region} · {new Date(c.since).getFullYear()}년 {new Date(c.since).getMonth() + 1}월부터
          </T>
        </View>
      </View>
      {c.intro ? (
        <T size={15} color={C.body2} lh={1.45}>
          {c.intro}
        </T>
      ) : null}
      <Tap onPress={() => navigation.navigate('CrewLevel', { crewId: c.id })} style={{ borderRadius: 18, backgroundColor: C.soft, paddingVertical: 8, paddingLeft: 8, paddingRight: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <LevelBadge level={c.level.level} size={44} />
        <View style={{ flex: 1, gap: 6 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <T size={13} weight="600">
              {c.level.title}
            </T>
            <T size={13} color={C.sub}>
              Lv {c.level.level + 1}까지{' '}
              <T size={13} color={C.sub} rounded>
                {c.level.toNext}
              </T>{' '}
              XP
            </T>
          </View>
          <View style={{ height: 6, borderRadius: 3, backgroundColor: C.line, overflow: 'hidden' }}>
            <View style={{ width: `${c.level.into / 10}%`, height: 6, borderRadius: 3, backgroundColor: C.limeEdge }} />
          </View>
        </View>
        <IcChevron />
      </Tap>
      {a ? (
        <Tap onPress={() => navigation.navigate('ChallengeJoin', { challengeId: a.id })}>
          <Glass kind="lime" style={{ borderRadius: 20, paddingVertical: 8, paddingLeft: 8, paddingRight: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 56, height: 44, borderRadius: 12, backgroundColor: '#FFFFFF', padding: 4 }}>
              <ShapeGlyph shape={a.shapeKey} w={48} h={36} />
            </View>
            <View style={{ flex: 1, gap: 1 }}>
              <T size={12} weight="600" color={C.limeDeep}>
                지금 그리는 중
              </T>
              <T size={16} weight="600">
                {a.title.replace(' 챌린지', '')} · {pct(a.progress)} · {Math.max(0, Math.ceil((new Date(a.endAt).getTime() - Date.now()) / 86_400_000))}일 남음
              </T>
            </View>
            <IcChevron color={C.ink} />
          </Glass>
        </Tap>
      ) : null}
      <View style={{ gap: 8, marginTop: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 2 }}>
          <T size={17} weight="700">
            크루 작품{' '}
            <T size={17} weight="500" color={C.sub}>
              {works.data?.length ?? 0}
            </T>
          </T>
          <Tap noScale onPress={() => navigation.navigate('Tabs', { screen: 'Gallery' } as never)}>
            <T size={15} weight="500" color={C.limeText}>
              모두 보기
            </T>
          </Tap>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {(works.data ?? []).slice(0, 3).map((w) => (
            <Tap key={w.id} onPress={() => navigation.navigate('Artwork', { challengeId: w.id })} style={{ flex: 1, maxWidth: '33%' }}>
              <Glass style={{ borderRadius: 18, padding: 6, gap: 6 }}>
                <View style={{ height: 72, borderRadius: 14, overflow: 'hidden', backgroundColor: C.map.land }}>
                  <Measure height={72}>{(wd) => <RouteArt route={w.route} segments={w.segments} w={wd} h={72} pad={8} stroke={3.5} map={false} hideRemaining={w.status === 'completed'} />}</Measure>
                </View>
                <View style={{ paddingHorizontal: 4, paddingBottom: 2 }}>
                  <T size={14} weight="600" numberOfLines={1}>
                    {w.name}
                  </T>
                  <T size={12} color={C.sub}>
                    {w.status === 'completed' ? md(w.endedAt) : '미완료 보관'}
                  </T>
                </View>
              </Glass>
            </Tap>
          ))}
        </View>
      </View>
      <View style={{ gap: 8, marginTop: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 2 }}>
          <T size={17} weight="700">
            멤버{' '}
            <T size={17} weight="500" color={C.sub}>
              {c.memberCount}
            </T>
          </T>
          <Tap noScale onPress={() => navigation.navigate('CrewMembers', { crewId: c.id })}>
            <T size={15} weight="500" color={C.limeText}>
              {leader ? '멤버 관리' : '모두 보기'}
            </T>
          </Tap>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 12 }}>
          {c.members.slice(0, 9).map((m) => (
            <View key={m.id} style={{ width: '20%', alignItems: 'center', gap: 5 }}>
              <Avatar letter={m.name.slice(0, 1)} color={m.color} size={48} style={{ boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)' }}>
                {m.role === 'leader' ? (
                  <View accessibilityLabel="크루장" style={{ position: 'absolute', right: -2, bottom: -2, width: 20, height: 20, borderRadius: 10, backgroundColor: C.lime, alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 0 2px #FFFFFF' }}>
                    <IcCrown />
                  </View>
                ) : null}
              </Avatar>
              <T size={13} color={C.body2} numberOfLines={1}>
                {m.isMe ? '나' : m.name}
              </T>
            </View>
          ))}
          <Tap onPress={() => navigation.navigate('CrewInvite', { crewId: c.id })} style={{ width: '20%', alignItems: 'center', gap: 5 }}>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', boxShadow: shadow.soft }}>
              <IcPlus size={20} />
            </View>
            <T size={13} color={C.body2}>
              초대
            </T>
          </Tap>
        </View>
      </View>
      <Group style={{ marginTop: 4, paddingVertical: 2 }}>
        {leader ? <Row label="크루 정보 편집" minHeight={48} onPress={() => navigation.navigate('CrewEdit', { crewId: c.id })} /> : null}
        <Row label="크루 설정" minHeight={48} onPress={() => navigation.navigate('CrewSettings', { crewId: c.id })} />
        <Row label="크루 나가기" color={C.danger} minHeight={48} chevron={false} onPress={() => navigation.navigate('CrewLeave', { crewId: c.id })} />
      </Group>
    </Screen>
  );
}

function LevelBadge({ level, size }: { level: number; size: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' }}>
      <T size={size * 0.2} weight="700" color={C.lime} style={{ lineHeight: size * 0.22 }}>
        Lv
      </T>
      <T size={size * 0.41} weight="800" color={C.lime} rounded style={{ lineHeight: size * 0.45 }}>
        {level}
      </T>
    </View>
  );
}

// ---------- 28 크루 정보 편집 ----------

const SWATCHES = [
  { hex: '#A3E635', label: '연두' },
  { hex: '#2B63F0', label: '파랑' },
  { hex: '#C24E0E', label: '주황' },
  { hex: '#0B7A6E', label: '청록' },
  { hex: '#7A5AF8', label: '보라' },
  { hex: '#1D1D1F', label: '검정' },
];

export function CrewEdit({ navigation, route }: P<'CrewEdit'>) {
  const crew = useCrew(route.params.crewId);
  const [f, setF] = useState<Partial<CrewDetail> | null>(null);
  useEffect(() => {
    if (crew.data && !f) setF({ name: crew.data.name, intro: crew.data.intro, photoUrl: crew.data.photoUrl, color: crew.data.color, discoverable: crew.data.discoverable });
  }, [crew.data, f]);
  const picker = usePhotoPicker((url) => setF((cur) => ({ ...cur, photoUrl: url })));
  const save = useAction((b: Partial<CrewDetail>) => api(`/crews/${route.params.crewId}`, { method: 'PATCH', body: b }), [['crew'], ['crews']]);
  if (!crew.data || !f) return <Loading />;
  return (
    <Screen gap={16} footer={<Btn title="저장" loading={save.isPending} onPress={() => save.mutate(f, { onSuccess: () => navigation.goBack() })} />}>
      <NavBar onBack={() => navigation.goBack()} kind="close" title="크루 정보 편집" />
      <View style={{ alignItems: 'center', gap: 10 }}>
        <Tap onPress={picker.pick} label="크루 사진 바꾸기" style={{ borderRadius: 28, boxShadow: '0 10px 28px rgba(0, 0, 0, 0.12)' }}>
          {f.photoUrl ? <CrewPhoto uri={f.photoUrl} size={96} radius={28} /> : <CrewAvatar crew={{ name: f.name || '?', color: f.color }} size={96} radius={28} />}
          <View style={{ position: 'absolute', right: -4, bottom: -4, width: 32, height: 32, borderRadius: 16, backgroundColor: C.lime, alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 0 3px #FFFFFF' }}>
            <IcCamera size={16} />
          </View>
        </Tap>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Btn title="사진 선택" kind="secondary" height={36} textSize={14} loading={picker.busy} onPress={picker.pick} />
          {f.photoUrl ? <Btn title="사진 지우기" kind="ghost" height={36} textSize={14} onPress={() => setF({ ...f, photoUrl: null })} style={{ backgroundColor: 'transparent' }} /> : null}
        </View>
        {picker.error ? (
          <T size={13} color={C.danger}>
            {picker.error}
          </T>
        ) : null}
        {!f.photoUrl ? (
          <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: 10 }}>
            {SWATCHES.map((s) => (
              <Pressable
                key={s.hex}
                accessibilityRole="radio"
                accessibilityLabel={s.label}
                accessibilityState={{ checked: f.color === s.hex }}
                onPress={() => setF({ ...f, color: s.hex })}
                style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: s.hex, boxShadow: f.color === s.hex ? `0 0 0 3px #FFFFFF, 0 0 0 5px ${s.hex}` : undefined }}
              />
            ))}
          </View>
        ) : null}
      </View>
      <Field label="크루 이름" value={f.name} onChangeText={(t) => setF({ ...f, name: t.slice(0, 16) })} />
      <Field
        label="소개"
        right={
          <T size={13} color={C.sub} rounded>
            {(f.intro ?? '').length}/80
          </T>
        }
        multiline
        value={f.intro}
        onChangeText={(t) => setF({ ...f, intro: t.slice(0, 80) })}
      />
      <View style={{ gap: 6 }}>
        <T size={13} weight="600">
          활동 지역
        </T>
        <Glass style={{ borderRadius: 20, paddingVertical: 12, paddingHorizontal: 16, gap: 2 }}>
          <T size={16} weight="600">
            {crew.data.region}
          </T>
        </Glass>
      </View>
      <Group>
        <Row label="크루 찾기에 보이기" hint="근처 러너가 크루를 찾고 가입을 요청할 수 있어요" minHeight={56} right={<Toggle on={!!f.discoverable} onChange={(v) => setF({ ...f, discoverable: v })} label="크루 찾기에 보이기" />} />
      </Group>
      <ErrorText error={save.error} />
    </Screen>
  );
}

// ---------- 29 멤버 관리 · 가입 요청 ----------

export function CrewMembers({ navigation, route }: P<'CrewMembers'>) {
  const id = route.params.crewId;
  const crew = useCrew(id);
  const [open, setOpen] = useState<number | null>(null);
  const decide = useAction(({ rid, accept }: { rid: number; accept: boolean }) => api(`/crews/${id}/requests/${rid}`, { body: { accept } }), [['crew'], ['crews']]);
  const transfer = useAction((uid: number) => api(`/crews/${id}/members/${uid}/role`, { method: 'PATCH', body: {} }), [['crew'], ['crews'], ['me']]);
  const kick = useAction((uid: number) => api(`/crews/${id}/members/${uid}`, { method: 'DELETE' }), [['crew'], ['crews']]);
  if (!crew.data) return <Loading />;
  const c = crew.data;
  const leader = c.myRole === 'leader';
  const sel = c.members.find((m) => m.id === open);
  return (
    <View style={{ flex: 1 }}>
      <Screen gap={12}>
        <NavBar onBack={() => navigation.goBack()} />
        <H1>멤버</H1>
        {leader && c.joinRequests?.length ? (
          <>
            <T size={13} weight="600" color={C.sub} style={{ marginTop: 8, marginLeft: 4 }}>
              가입 요청 {c.joinRequests.length}
            </T>
            {c.joinRequests.map((r) => (
              <Glass key={r.id} style={{ borderRadius: 20, paddingVertical: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Pressable accessibilityRole="link" onPress={() => navigation.navigate('UserProfile', { userId: r.userId })} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Avatar letter={r.name.slice(0, 1)} color={C.seg} ink={C.ink} size={40} />
                  <T size={16} weight="600" style={{ flex: 1 }}>
                    {r.name}
                  </T>
                </Pressable>
                <Btn title="거절" kind="secondary" height={36} textSize={14} onPress={() => decide.mutate({ rid: r.id, accept: false })} />
                <Btn title="수락" height={36} textSize={14} style={{ backgroundColor: C.lime, boxShadow: undefined }} onPress={() => decide.mutate({ rid: r.id, accept: true })} />
              </Glass>
            ))}
          </>
        ) : null}
        <T size={13} weight="600" color={C.sub} style={{ marginTop: 8, marginLeft: 4 }}>
          멤버 {c.members.length}
        </T>
        <Glass style={{ borderRadius: 20, paddingVertical: 4, paddingLeft: 16, paddingRight: 8 }}>
          {c.members.map((m) => (
            <View key={m.id} style={{ minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Pressable accessibilityRole="link" disabled={m.isMe} onPress={() => navigation.navigate('UserProfile', { userId: m.id })} style={{ flex: 1, minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Avatar letter={m.name.slice(0, 1)} color={m.color} size={40} />
              <View style={{ flex: 1, gap: 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <T size={16} weight="600">
                    {m.name}
                    {m.isMe ? ' (나)' : ''}
                  </T>
                  {m.role === 'leader' ? (
                    <View style={{ height: 20, paddingHorizontal: 7, borderRadius: 10, backgroundColor: C.lime, justifyContent: 'center' }}>
                      <T size={11} weight="600">
                        크루장
                      </T>
                    </View>
                  ) : null}
                </View>
                <T size={13} color={C.sub}>
                  {m.monthRuns ? `이번 달 ${m.monthRuns}회 달림 · ${m.monthKm}km` : `${md(m.joinedAt)} 가입`}
                </T>
              </View>
              </Pressable>
              {leader && !m.isMe ? (
                <Tap noScale label={`${m.name} 관리`} onPress={() => setOpen(m.id)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                  <IcMore size={20} color={C.sub} />
                </Tap>
              ) : null}
            </View>
          ))}
        </Glass>
        <T size={13} color={C.sub} lh={1.45} style={{ marginHorizontal: 4 }}>
          크루를 떠난 멤버가 달린 구간은 작품에 그대로 남아요.
        </T>
        <ErrorText error={decide.error ?? transfer.error ?? kick.error} />
      </Screen>
      <Sheet open={!!sel} onClose={() => setOpen(null)} inset={8} radius={28}>
        {sel ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 4 }}>
              <Avatar letter={sel.name.slice(0, 1)} color={sel.color} size={44} />
              <T size={20} weight="700">
                {sel.name}
              </T>
            </View>
            <Btn title="크루장 넘기기" kind="secondary" loading={transfer.isPending} onPress={() => transfer.mutate(sel.id, { onSuccess: () => setOpen(null) })} />
            <Btn title="크루에서 내보내기" kind="dangerSoft" loading={kick.isPending} onPress={() => kick.mutate(sel.id, { onSuccess: () => setOpen(null) })} />
            <Btn title="취소" kind="ghost" onPress={() => setOpen(null)} style={{ backgroundColor: 'transparent' }} />
          </>
        ) : null}
      </Sheet>
    </View>
  );
}

// ---------- 30 크루 초대 ----------

export function CrewInvite({ navigation, route }: P<'CrewInvite'>) {
  const id = route.params.crewId;
  const crew = useCrew(id);
  const [copied, setCopied] = useState<'' | 'code' | 'link'>('');
  const renew = useAction(() => api(`/crews/${id}/invites`, { body: {} }), [['crew', id]]);
  useEffect(() => {
    if (crew.data && !crew.data.invite && !renew.isPending && !renew.isSuccess) renew.mutate(undefined);
  }, [crew.data, renew]);
  if (!crew.data) return <Loading />;
  const inv = crew.data.invite;
  const code = inv?.code ?? '------';
  const days = inv ? Math.max(0, Math.ceil((new Date(inv.expiresAt).getTime() - Date.now()) / 86_400_000)) : 7;
  const link = `[앱 링크]/${code}`; // 앱 링크 미정(기획서)
  const approve = crew.data.joinPolicy === 'approve';
  return (
    <Screen
      gap={14}
      footer={<Btn title="초대 링크 보내기" onPress={() => Share.share({ message: `${crew.data.name}에서 트래피티로 함께 그림 그려요! 초대 코드 ${code} · ${link}` }).catch(() => {})} />}
    >
      <NavBar onBack={() => navigation.goBack()} />
      <View style={{ gap: 6 }}>
        <H1>크루 초대</H1>
        <Sub>{approve ? '코드를 받은 사람이 가입을 요청하면 수락 후 들어와요.' : '코드나 링크를 받은 사람은 바로 크루에 들어와요.'}</Sub>
      </View>
      <Glass style={{ borderRadius: 20, paddingTop: 24, paddingHorizontal: 16, paddingBottom: 16, alignItems: 'center', gap: 6 }}>
        <T size={13} weight="600" color={C.sub}>
          초대 코드
        </T>
        <T size={40} weight="700" rounded ls={0.18}>
          {code.slice(0, 3)} {code.slice(3)}
        </T>
        <T size={13} color={C.sub}>
          {days}일 뒤 만료
        </T>
        <View style={{ flexDirection: 'row', gap: 8, alignSelf: 'stretch', marginTop: 10 }}>
          <Btn
            title={copied === 'code' ? '복사했어요' : '코드 복사'}
            kind="secondary"
            height={44}
            textSize={15}
            flex
            onPress={async () => {
              await Clipboard.setStringAsync(code);
              setCopied('code');
            }}
          />
          <Btn title="새 코드 만들기" kind="secondary" height={44} textSize={15} flex loading={renew.isPending} onPress={() => (setCopied(''), renew.mutate(undefined))} />
        </View>
      </Glass>
      <Group>
        <Row
          label="초대 링크"
          hint={link}
          minHeight={56}
          right={
            <Btn
              title={copied === 'link' ? '복사함' : '복사'}
              kind="secondary"
              height={36}
              textSize={14}
              onPress={async () => {
                await Clipboard.setStringAsync(link);
                setCopied('link');
              }}
            />
          }
        />
        <Row label="이름으로 찾아 초대" minHeight={56} onPress={() => navigation.navigate('UserSearch', { crewId: id })} />
        <Row label="가입 방식" value={approve ? '크루장 승인' : '바로 가입'} minHeight={56} onPress={() => navigation.navigate('CrewSettings', { crewId: id })} />
      </Group>
      <ErrorText error={renew.error} />
    </Screen>
  );
}

// ---------- 31 크루 나가기 · 삭제 ----------

export function CrewLeave({ navigation, route }: P<'CrewLeave'>) {
  const qc = useQueryClient();
  const setAuth = useAuth((s) => s.set);
  const b = useBottom();
  const crew = useCrew(route.params.crewId);
  const [typed, setTyped] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const done = async (msg?: string) => {
    setAuth({ crewId: null });
    await qc.invalidateQueries({ queryKey: ['crews'] });
    if (msg) setNotice(msg);
    else navigation.reset({ index: 0, routes: [{ name: 'Tabs' }] });
  };
  const leave = useAction(async () => {
    const r = await api(`/crews/${route.params.crewId}/leave`, { body: {} });
    await done(r.newPrimary ? `대표 크루가 ${r.newPrimary.name}로 바뀌었어요.` : undefined);
  });
  const del = useAction(async () => {
    await api(`/crews/${route.params.crewId}`, { method: 'DELETE', body: { confirmName: typed } });
    await done();
  });
  if (!crew.data) return <Loading />;
  const c = crew.data;
  const alone = c.memberCount <= 1;
  const kind = c.myRole === 'leader' ? (alone || route.params.delete ? 'delete' : 'leader') : 'member';
  const active = c.activeChallenge?.title;
  const D = {
    member: {
      title: `${c.name}에서 나갈까요?`,
      points: ['내가 달린 구간은 크루 작품에 그대로 남고, 이름은 ‘나간 크루원’으로 보여요.', active ? `진행 중인 ${active}에서 빠져요.` : '진행 중인 챌린지가 없어요.', '다시 들어오려면 새 초대 코드가 필요해요.'],
    },
    leader: { title: '크루장은 바로 나갈 수 없어요', points: ['다른 크루원에게 크루장을 넘긴 뒤 나갈 수 있어요.', '혼자 남은 크루라면 크루를 삭제할 수 있어요.'] },
    delete: { title: `${c.name}을 삭제할까요?`, points: ['모든 크루원이 크루에서 빠지고, 진행 중인 챌린지가 끝나요.', '완성한 작품은 각자의 갤러리에 남아요.', '삭제하면 되돌릴 수 없어요.'] },
  }[kind];
  return (
    <View style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.3)' }}>
      <Pressable style={StyleSheet.absoluteFill} onPress={() => navigation.goBack()} />
      <Glass kind="sheet" style={{ position: 'absolute', left: 8, right: 8, bottom: 8, borderRadius: 28, backgroundColor: 'rgba(255, 255, 255, 0.92)', paddingTop: 24, paddingHorizontal: 20, paddingBottom: Math.max(16, b - 26), gap: 14 }}>
        <T size={22} weight="700" lh={1.3} ls={-0.02}>
          {notice ? '크루에서 나왔어요' : D.title}
        </T>
        {notice ? (
          <T size={15} color={C.body2} lh={1.5}>
            {notice}
          </T>
        ) : (
          <View style={{ gap: 6, paddingLeft: 4 }}>
            {D.points.map((p) => (
              <T key={p} size={15} color={C.body2} lh={1.5}>
                • {p}
              </T>
            ))}
          </View>
        )}
        {!notice && kind === 'delete' ? <Field label="확인을 위해 크루 이름을 입력해 주세요" height={50} value={typed} onChangeText={setTyped} /> : null}
        <View style={{ gap: 8, marginTop: 4 }}>
          {notice ? (
            <Btn title="확인" onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Tabs' }] })} />
          ) : kind === 'leader' ? (
            <Btn title="크루장 넘기러 가기" onPress={() => navigation.replace('CrewMembers', { crewId: c.id })} />
          ) : kind === 'member' ? (
            <Btn title="크루 나가기" kind="danger" loading={leave.isPending} onPress={() => leave.mutate(undefined)} />
          ) : (
            <Btn title="크루 삭제" kind="danger" disabled={typed.trim() !== c.name} loading={del.isPending} onPress={() => del.mutate(undefined)} />
          )}
          {!notice ? <Btn title="취소" kind="secondary" onPress={() => navigation.goBack()} /> : null}
          <ErrorText error={leave.error ?? del.error} />
        </View>
      </Glass>
    </View>
  );
}

// ---------- 27-1 크루 설정 ----------

export function CrewSettings({ navigation, route }: P<'CrewSettings'>) {
  const id = route.params.crewId;
  const crew = useCrew(id);
  const save = useAction((b: Record<string, unknown>) => api(`/crews/${id}`, { method: 'PATCH', body: b }), [['crew'], ['crews']]);
  const notify = useAction((on: boolean) => api(`/crews/${id}/me`, { method: 'PATCH', body: { notify: on } }), [['crew', id]]);
  if (!crew.data) return <Loading />;
  const c = crew.data;
  const leader = c.myRole === 'leader';
  const groups: { key: string; title: string; value: string | undefined; options: [string, string, string][] }[] = [
    { key: 'joinPolicy', title: '가입 방식', value: c.joinPolicy, options: [['code', '초대 코드로 바로 가입', '코드나 링크를 받은 사람은 바로 들어와요'], ['approve', '크루장이 승인한 뒤 가입', '요청은 멤버 화면에 쌓여요']] },
    { key: 'challengePermission', title: '챌린지 만들기', value: c.challengePermission, options: [['leader', '크루장만', '크루장이 코스를 정하고 공유해요'], ['all', '모든 크루원', '누구나 만들 수 있어요 · 진행 중 챌린지는 크루당 1개']] },
    { key: 'artworkVisibility', title: '작품 기본 공개', value: c.artworkVisibility, options: [['crew', '크루원만', '완성 작품을 크루 안에서만 봐요'], ['public', '모두에게', '크루 랭킹과 다른 크루의 갤러리에도 보여요']] },
  ];
  return (
    <Screen gap={10} bottomSpace={48}>
      <NavBar onBack={() => navigation.goBack()} />
      <H1 style={{ marginBottom: 4 }}>크루 설정</H1>
      {!leader ? (
        <T size={14} color={C.sub} lh={1.5} style={{ marginHorizontal: 4, marginBottom: 4 }}>
          크루 규칙은 크루장 {c.leaderName}님만 바꿀 수 있어요. 알림은 나에게만 적용돼요.
        </T>
      ) : null}
      {groups.map((g) => (
        <Group key={g.key} title={g.title} style={{ marginTop: 2 }}>
          {g.options.map(([v, l, h]) => (
            <RadioRow key={v} label={l} hint={h} minHeight={60} on={g.value === v} disabled={!leader} onPress={() => save.mutate({ [g.key]: v })} />
          ))}
        </Group>
      ))}
      <Group title="나에게만">
        <Row label="이 크루 알림" hint="새 챌린지, 이어 달리기, 작품 완성" minHeight={56} right={<Toggle on={c.myNotify ?? true} onChange={(v) => notify.mutate(v)} label="이 크루 알림" />} />
      </Group>
      {leader ? (
        <>
          <Group style={{ marginTop: 24, paddingVertical: 2 }}>
            <Row label="크루 삭제" color={C.danger} minHeight={50} chevron={false} onPress={() => navigation.navigate('CrewLeave', { crewId: id, delete: true })} />
          </Group>
          <T size={13} color={C.sub} lh={1.45} style={{ marginHorizontal: 4 }}>
            크루를 삭제하면 모든 크루원이 빠지고 되돌릴 수 없어요.
          </T>
        </>
      ) : null}
      <ErrorText error={save.error ?? notify.error} />
    </Screen>
  );
}

// ---------- 27-2 크루 레벨 ----------

const REWARDS = [
  { lv: 5, label: '기록 색 팔레트 넓히기' },
  { lv: 8, label: '그림 라이브러리 새 그림 3개' },
  { lv: 10, label: '공유 이미지 크루 테두리' },
  { lv: 15, label: '크루 사진 금색 링' },
];

export function CrewLevel({ navigation, route }: P<'CrewLevel'>) {
  const crew = useCrew(route.params.crewId);
  if (!crew.data) return <Loading />;
  const c = crew.data;
  const L = c.level;
  let nextSet = false;
  return (
    <Screen gap={12}>
      <NavBar onBack={() => navigation.goBack()} />
      <H1>크루 레벨</H1>
      <Glass kind="lime" style={{ borderRadius: 24, padding: 20, gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <LevelBadge level={L.level} size={64} />
          <View style={{ gap: 2 }}>
            <T size={13} weight="600" color={C.limeDeep}>
              {c.name}
            </T>
            <T size={22} weight="700">
              {L.title}
            </T>
          </View>
        </View>
        <View style={{ gap: 6 }}>
          <View style={{ height: 12, borderRadius: 6, backgroundColor: 'rgba(29, 29, 31, 0.14)', overflow: 'hidden' }}>
            <View style={{ width: `${L.into / 10}%`, height: 12, borderRadius: 6, backgroundColor: C.ink }} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <T size={13} color={C.limeDeep}>
              <T size={13} weight="700" rounded>
                {L.into}
              </T>{' '}
              / 1,000 XP
            </T>
            <T size={13} color={C.limeDeep}>
              Lv {L.level + 1}까지{' '}
              <T size={13} weight="700" rounded>
                {L.toNext}
              </T>{' '}
              XP
            </T>
          </View>
        </View>
      </Glass>
      <Group title="XP 얻는 법" style={{ paddingVertical: 2 }}>
        {[
          ['1km 달리기', '+10 XP'],
          ['작품 완성', '+200 XP'],
          ['크루원 모두 참여한 챌린지', '+100 XP'],
        ].map(([l, v]) => (
          <Row key={l} label={<T size={15}>{l}</T>} minHeight={48} value={<T size={15} weight="700" color={C.limeText} rounded>{v}</T>} />
        ))}
      </Group>
      <Group title="레벨 보상" style={{ paddingVertical: 2 }}>
        {REWARDS.map((r) => {
          const got = r.lv <= L.level;
          const next = !got && !nextSet;
          if (next) nextSet = true;
          return (
            <View key={r.lv} style={{ minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 52, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: got ? C.lime : next ? 'rgba(163, 230, 53, 0.35)' : C.field }}>
                <T size={12} weight="700" color={got || next ? C.ink : C.sub2}>
                  Lv {r.lv}
                </T>
              </View>
              <T size={15} color={got || next ? C.ink : C.sub2} style={{ flex: 1 }}>
                {r.label}
              </T>
              {got ? <IcCheck size={16} /> : null}
              {next ? (
                <T size={12} weight="600" color={C.limeText}>
                  다음 보상
                </T>
              ) : null}
            </View>
          );
        })}
      </Group>
    </Screen>
  );
}
