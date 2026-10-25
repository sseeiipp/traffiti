import { useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, TextInput, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { api } from '../api/client';
import { useAction, useCrew, useMe, useMyCrews, type Me } from '../api/hooks';
import { usePhotoPicker } from '../api/photo';
import type { P } from '../navigation/types';
import { useAuth } from '../store/auth';
import { C, font } from '../theme';
import { IcCamera, IcCheck } from '../ui/icons';
import {
  Avatar,
  Btn,
  CheckCircle,
  CrewPhoto,
  ErrorText,
  Field,
  Glass,
  Group,
  H1,
  Loading,
  NavBar,
  RadioRow,
  Row,
  Screen,
  Segmented,
  Sub,
  T,
  Tap,
  Toggle,
} from '../ui/kit';

/** 설정 하나를 바로 저장(화면은 먼저 바뀐다) */
function useSettings(me?: Me) {
  const qc = useQueryClient();
  const [local, setLocal] = useState<Me['settings'] | null>(null);
  useEffect(() => {
    if (me) setLocal(me.settings);
  }, [me]);
  const save = async (patch: Partial<Me['settings']>) => {
    setLocal((s) => (s ? { ...s, ...patch } : s));
    try {
      await api('/users/me/settings', { method: 'PATCH', body: patch });
    } finally {
      qc.invalidateQueries({ queryKey: ['me'] });
    }
  };
  return [local, save] as const;
}

const PROVIDER: Record<string, string> = { kakao: '카카오', naver: '네이버', google: 'Google', email: '이메일' };

// ---------- 06-1 내 설정 ----------

export function MySettings({ navigation }: P<'MySettings'>) {
  const qc = useQueryClient();
  const me = useMe();
  const crews = useMyCrews();
  const logout = useAuth((s) => s.logout);
  const [s, save] = useSettings(me.data);
  const [perm, setPerm] = useState('확인 중');
  useEffect(() => {
    Location.getForegroundPermissionsAsync()
      .then((p) => setPerm(p.granted ? '앱 사용 중' : p.canAskAgain ? '묻기 전' : '허용 안 함'))
      .catch(() => setPerm('알 수 없음'));
  }, []);
  if (!me.data || !s || !crews.data) return <Loading />;
  const u = me.data;
  const rep = crews.data.crews.find((c) => c.id === crews.data.primaryCrewId);
  const email = u.provider === 'email';
  return (
    <Screen gap={12} bottomSpace={48}>
      <NavBar onBack={() => navigation.goBack()} />
      <H1 style={{ marginBottom: 4 }}>내 설정</H1>
      <Glass style={{ borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <Avatar letter={u.name.slice(0, 1)} color={rep?.myColor ?? '#7A5AF8'} size={60} />
        <View style={{ flex: 1, gap: 2 }}>
          <T size={20} weight="600">
            {u.name}
          </T>
          <T size={14} color={C.sub}>
            {email ? u.email : `${PROVIDER[u.provider]} 계정으로 로그인`}
          </T>
          <T size={14} color={C.sub}>
            대표 크루 · {rep?.name ?? '없음'}
          </T>
        </View>
        <Btn title="편집" kind="secondary" height={36} textSize={14} onPress={() => navigation.navigate('ProfileEdit')} />
      </Glass>

      <Group title="러닝">
        <Row label="주로 달리는 지역" value={s.region} />
        <Row label="지역 자동 업데이트" right={<Toggle on={s.regionAuto} onChange={(v) => save({ regionAuto: v })} label="지역 자동 업데이트" />} />
        <Row
          label="크루별 기록 색"
          onPress={() => navigation.navigate('ProfileEdit')}
          value={
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ flexDirection: 'row' }}>
                {crews.data.crews.map((c, i) => (
                  <View key={c.id} style={{ marginLeft: i ? -4 : 0, width: 14, height: 14, borderRadius: 7, backgroundColor: c.myColor, boxShadow: '0 0 0 2px #FFFFFF' }} />
                ))}
              </View>
              <T size={15} color={C.sub}>
                {crews.data.crews.length}개 크루
              </T>
            </View>
          }
        />
        <Row
          label="거리 단위"
          right={
            <Segmented
              small
              style={{ width: 110, borderRadius: 9 }}
              items={[
                { key: 'km', label: 'km' },
                { key: 'm', label: 'm' },
              ]}
              value={s.distanceUnit === 'm' ? 'm' : 'km'}
              onChange={(v) => save({ distanceUnit: v })}
            />
          }
        />
      </Group>

      <Group title="개인정보와 위치">
        <Row label="위치 권한" value={perm} onPress={() => navigation.navigate('LocationNeeded')} />
        <Row label="상세 GPS 경로 공개" value={s.gpsVisibility === 'me' ? '나만 보기' : '크루원'} onPress={() => navigation.navigate('PrivacyScope')} />
        <Row label="완성 작품 공개" value={s.artworkVisibility === 'crew' ? '크루원만' : '모두에게'} onPress={() => navigation.navigate('PrivacyScope')} />
        <Row label="공유 시 출발 지점 숨기기" right={<Toggle on={s.hideStartOnShare} onChange={(v) => save({ hideStartOnShare: v })} label="공유 시 출발 지점 숨기기" />} />
      </Group>

      <Group title="알림">
        <Row label="새 챌린지" right={<Toggle on={s.notifyNewChallenge} onChange={(v) => save({ notifyNewChallenge: v })} label="새 챌린지 알림" />} />
        <Row label="크루원이 구간을 채웠을 때" right={<Toggle on={s.notifySegment} onChange={(v) => save({ notifySegment: v })} label="크루원 구간 알림" />} />
        <Row label="작품 완성" right={<Toggle on={s.notifyArtwork} onChange={(v) => save({ notifyArtwork: v })} label="작품 완성 알림" />} />
      </Group>

      <Group title="계정">
        {email ? (
          <Row label="비밀번호 변경" onPress={() => navigation.navigate('PasswordReset')} />
        ) : (
          <Row label="로그인 방식" value={`${PROVIDER[u.provider]}로 로그인 중`} />
        )}
        <Row label="크루 정보 · 나가기" onPress={() => navigation.navigate('CrewManage')} />
        <Row label="내 크루 · 대표 크루" value={rep?.name} onPress={() => navigation.navigate('CrewSwitcher')} />
      </Group>

      {/* 디자인: 로그아웃은 가운데 빨간 글자 한 줄, 계정 삭제는 그 아래 작은 회색 글자 */}
      <Group style={{ marginTop: 12 }}>
        <Tap
          noScale
          label="로그아웃"
          onPress={() => {
            qc.clear();
            logout();
          }}
          style={{ minHeight: 52, alignItems: 'center', justifyContent: 'center' }}
        >
          <T size={16} weight="500" color={C.danger}>
            로그아웃
          </T>
        </Tap>
      </Group>
      <Tap noScale label="계정 삭제" onPress={() => navigation.navigate('AccountDelete')} style={{ alignSelf: 'center', height: 44, paddingHorizontal: 12, justifyContent: 'center' }}>
        <T size={14} color={C.sub}>
          계정 삭제
        </T>
      </Tap>
    </Screen>
  );
}

// ---------- 06-2 프로필 편집 ----------

const toRgb = (hx: string) => [1, 3, 5].map((i) => parseInt(hx.slice(i, i + 2), 16));
const toHex = (r: number, g: number, b: number) =>
  '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('').toUpperCase();
const hueRgb = (h: number) => {
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return 255 * (0.5 - 0.5 * Math.max(-1, Math.min(k - 3, 9 - k, 1)));
  };
  return [f(0), f(8), f(4)];
};
const dist = (a: string, b: string) => {
  const x = toRgb(a);
  const y = toRgb(b);
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
};

export function ProfileEdit({ navigation }: P<'ProfileEdit'>) {
  const qc = useQueryClient();
  const me = useMe();
  const crews = useMyCrews();
  const [name, setName] = useState<string | null>(null);
  // undefined: 그대로, null: 지우기, 문자열: 새로 올린 사진
  const [photo, setPhoto] = useState<string | null | undefined>(undefined);
  const picker = usePhotoPicker(setPhoto);
  const [sel, setSel] = useState<number | null>(null);
  const [colors, setColors] = useState<Record<number, string>>({});
  const [marks, setMarks] = useState<Record<number, [number, number]>>({});
  const [draft, setDraft] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [fieldW, setFieldW] = useState(0);
  const crewId = sel ?? crews.data?.crews[0]?.id ?? null;
  const detail = useCrew(crewId);
  useEffect(() => {
    if (crews.data && !Object.keys(colors).length) setColors(Object.fromEntries(crews.data.crews.map((c) => [c.id, c.myColor])));
  }, [crews.data, colors]);
  const taken = useMemo(() => (detail.data?.members ?? []).filter((m) => !m.isMe), [detail.data]);

  const save = useAction(async () => {
    await api('/users/me', { method: 'PATCH', body: { name: name ?? undefined, photoUrl: photo } });
    for (const c of crews.data?.crews ?? []) {
      if (colors[c.id] && colors[c.id] !== c.myColor) await api(`/crews/${c.id}/me`, { method: 'PATCH', body: { color: colors[c.id] } });
    }
    await qc.invalidateQueries({ queryKey: ['me'] });
    await qc.invalidateQueries({ queryKey: ['crews'] });
    navigation.goBack();
  });

  if (!me.data || !crews.data || crewId == null) return <Loading />;
  const nm = name ?? me.data.name;
  const photoUrl = photo === undefined ? me.data.photoUrl : photo;
  const cur = colors[crewId] ?? '#7A5AF8';
  const crewName = crews.data.crews.find((c) => c.id === crewId)?.name ?? '';
  const mark = marks[crewId] ?? [50, 40];

  const apply = (hx: string, m?: [number, number]) => {
    const clash = taken.find((t) => dist(t.color, hx) < 70);
    if (clash) {
      setErr(`${clash.name}님 색과 너무 비슷해요. 조금 다른 곳을 골라 주세요.`);
      setDraft(hx.slice(1));
      return;
    }
    setColors({ ...colors, [crewId]: hx });
    if (m) setMarks({ ...marks, [crewId]: m });
    setErr('');
    setDraft(null);
  };

  return (
    <Screen gap={14} footer={<Btn title="저장" loading={save.isPending} onPress={() => save.mutate(undefined)} />}>
      <NavBar onBack={() => navigation.goBack()} kind="close" title="프로필 편집" />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <Tap onPress={picker.pick} label="프로필 사진 바꾸기" style={{ width: 72, height: 72, borderRadius: 36, boxShadow: '0 8px 22px rgba(0, 0, 0, 0.12)' }}>
          {/* 사진이 없으면 빈 원만 둔다 */}
          <CrewPhoto uri={photoUrl} size={72} radius={36} />
          <View style={{ position: 'absolute', right: -2, bottom: -2, width: 26, height: 26, borderRadius: 13, backgroundColor: C.lime, alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 0 3px #FFFFFF' }}>
            <IcCamera />
          </View>
        </Tap>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Btn title="사진 선택" kind="secondary" height={36} textSize={14} loading={picker.busy} onPress={picker.pick} />
          {photoUrl ? <Btn title="사진 지우기" kind="ghost" height={36} textSize={14} onPress={() => setPhoto(null)} style={{ backgroundColor: 'transparent' }} /> : null}
        </View>
      </View>
      {picker.error ? (
        <T size={13} color={C.danger}>
          {picker.error}
        </T>
      ) : null}
      <Field
        label="크루에서 쓸 이름"
        right={
          <T size={13} color={C.sub} rounded>
            {nm.length}/10
          </T>
        }
        value={nm}
        onChangeText={(t) => setName(t.slice(0, 10))}
      />
      <View style={{ minHeight: 52, borderRadius: 14, backgroundColor: C.soft, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ flex: 1, gap: 1 }}>
          <T size={12} color={C.sub}>
            {me.data.email ? '이메일' : '로그인 계정'}
          </T>
          <T size={15}>{me.data.email ?? `${PROVIDER[me.data.provider]} 계정`}</T>
        </View>
        <T size={12} color={C.sub2}>
          로그인 계정 · 변경 불가
        </T>
      </View>
      <View style={{ gap: 8 }}>
        <T size={13} weight="600">
          크루별 기록 색
        </T>
        <Glass style={{ borderRadius: 18, padding: 4 }}>
          {crews.data.crews.map((c) => {
            const on = c.id === crewId;
            return (
              <Pressable
                key={c.id}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                onPress={() => {
                  setSel(c.id);
                  setErr('');
                  setDraft(null);
                }}
                style={{ minHeight: 44, paddingHorizontal: 12, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: on ? 'rgba(163, 230, 53, 0.25)' : 'transparent' }}
              >
                <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: colors[c.id] ?? c.myColor, boxShadow: 'inset 0 0 0 1px rgba(0, 0, 0, 0.08)' }} />
                <T size={15} weight="500" style={{ flex: 1 }}>
                  {c.name}
                </T>
                <T size={13} color={C.sub} rounded ls={0.02}>
                  {colors[c.id] ?? c.myColor}
                </T>
                {on ? <IcCheck size={16} /> : null}
              </Pressable>
            );
          })}
        </Glass>
        <Pressable
          accessibilityRole="adjustable"
          accessibilityLabel="색 고르기 영역"
          onLayout={(e) => setFieldW(e.nativeEvent.layout.width)}
          onPress={(e) => {
            const { locationX, locationY } = e.nativeEvent;
            const px = Math.max(0, Math.min(1, locationX / (fieldW || 1)));
            const py = Math.max(0, Math.min(1, locationY / 112));
            const base = hueRgb(px * 360);
            const a = Math.min(0.75, py * 0.9);
            apply(toHex(base[0] * (1 - a) + 255 * a, base[1] * (1 - a) + 255 * a, base[2] * (1 - a) + 255 * a), [Math.round(px * 100), Math.round(py * 100)]);
          }}
          style={{ height: 112, borderRadius: 16, overflow: 'hidden', boxShadow: 'inset 0 0 0 0.5px rgba(0, 0, 0, 0.08)' }}
        >
          <Svg width="100%" height={112} pointerEvents="none">
            <Defs>
              <LinearGradient id="hue" x1="0" y1="0" x2="1" y2="0">
                {[0, 60, 120, 180, 240, 300, 360].map((h) => (
                  <Stop key={h} offset={h / 360} stopColor={`hsl(${h}, 100%, 50%)`} />
                ))}
              </LinearGradient>
              <LinearGradient id="white" x1="0" y1="0" x2="0" y2="1">
                <Stop offset={0} stopColor="#FFFFFF" stopOpacity={0} />
                <Stop offset={1} stopColor="#FFFFFF" stopOpacity={0.8} />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height={112} fill="url(#hue)" />
            <Rect width="100%" height={112} fill="url(#white)" />
          </Svg>
          <View
            pointerEvents="none"
            style={{ position: 'absolute', left: `${mark[0]}%`, top: `${mark[1]}%`, marginLeft: -11, marginTop: -11, width: 22, height: 22, borderRadius: 11, backgroundColor: cur, boxShadow: '0 0 0 3px #FFFFFF, 0 2px 8px rgba(0, 0, 0, 0.3)' }}
          />
        </Pressable>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: cur, boxShadow: '0 4px 12px rgba(0, 0, 0, 0.12)' }} />
          <View style={{ flex: 1, height: 44, borderRadius: 14, backgroundColor: C.field, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 2 }}>
            <T size={16} weight="600" color={C.sub2} rounded>
              #
            </T>
            <TextInput
              value={draft ?? cur.slice(1)}
              maxLength={6}
              autoCapitalize="characters"
              accessibilityLabel="헥사코드 직접 입력"
              onChangeText={(t) => {
                const raw = t.replace('#', '').toUpperCase().slice(0, 6);
                if (/^[0-9A-F]{6}$/.test(raw)) apply('#' + raw);
                else {
                  setDraft(raw);
                  setErr(raw.length === 6 ? '0–9, A–F로 된 6자리 코드를 넣어 주세요.' : '');
                }
              }}
              style={[{ flex: 1, fontSize: 16, fontWeight: '600', letterSpacing: 1, color: C.ink, fontFamily: font.rounded }, Platform.OS === 'web' && ({ outlineStyle: 'none' } as any)]}
            />
          </View>
          <Svg width={56} height={26} viewBox="0 0 86 28">
            <Path d="M4 22 C18 6 30 6 42 14 C54 22 66 22 82 6" fill="none" stroke={cur} strokeWidth={7} strokeLinecap="round" />
          </Svg>
        </View>
        <T size={13} color={err ? C.danger : C.sub} lh={1.4}>
          {err || `${crewName}에서 쓸 색이에요. 영역을 눌러 고르거나 코드를 넣어요.`}
        </T>
        <ErrorText error={save.error} />
      </View>
    </Screen>
  );
}

// ---------- 06-3 공개 범위 ----------

export function PrivacyScope({ navigation }: P<'PrivacyScope'>) {
  const me = useMe();
  const [s, save] = useSettings(me.data);
  if (!s) return <Loading />;
  return (
    <Screen gap={16}>
      <NavBar onBack={() => navigation.goBack()} />
      <View style={{ gap: 6 }}>
        <H1>공개 범위</H1>
        <Sub>새로 만드는 기록의 기본값이에요. 챌린지마다 따로 바꿀 수도 있어요.</Sub>
      </View>
      <View style={{ gap: 8 }}>
        <Group title="상세 GPS 경로" first>
          <RadioRow label="나만 보기" hint="달린 길을 나만 자세히 봐요" on={s.gpsVisibility === 'me'} onPress={() => save({ gpsVisibility: 'me' })} />
          <RadioRow label="크루원" hint="같은 크루원도 자세한 길을 봐요" on={s.gpsVisibility === 'crew'} onPress={() => save({ gpsVisibility: 'crew' })} />
        </Group>
      </View>
      <View style={{ gap: 8 }}>
        <Group title="완성 작품" first>
          <RadioRow label="크루원만" hint="완성 작품을 크루 안에서만 봐요" on={s.artworkVisibility === 'crew'} onPress={() => save({ artworkVisibility: 'crew' })} />
          <RadioRow label="모두에게" hint="갤러리와 크루 상세에 보여요 · 출발 지점은 숨겨요" on={s.artworkVisibility === 'all'} onPress={() => save({ artworkVisibility: 'all' })} />
        </Group>
      </View>
      <T size={13} color={C.sub} lh={1.5} style={{ marginHorizontal: 4 }}>
        상세 경로는 기본으로 나만 봐요. 집이나 회사처럼 자주 출발하는 곳이 드러나지 않게 하려는 거예요.
      </T>
    </Screen>
  );
}

// ---------- 06-4 계정 삭제 ----------

export function AccountDelete({ navigation }: P<'AccountDelete'>) {
  const qc = useQueryClient();
  const me = useMe();
  const logout = useAuth((s) => s.logout);
  const [ok, setOk] = useState(false);
  const del = useAction(async () => {
    await api('/users/me', { method: 'DELETE' });
    qc.clear();
    logout();
  });
  if (!me.data) return <Loading />;
  const blocked = me.data.leaderOf.filter((l) => l.hasOthers);
  const items: [string, string][] = [
    ['러닝 기록과 GPS 경로는 지워져요', '달력·기록 상세에서 더 이상 볼 수 없어요.'],
    ['크루 작품의 내 구간은 남아요', "이름은 '나간 크루원'으로 바뀌어요."],
  ];
  if (blocked.length) items.push(['크루장인 크루가 있으면 먼저 넘겨 주세요', `${blocked.map((b) => b.name).join(', ')} 크루장을 다른 크루원에게 넘겨야 해요.`]);
  return (
    <Screen
      gap={16}
      footer={
        <>
          {blocked.length ? <Btn title="크루장 넘기러 가기" kind="secondary" onPress={() => navigation.navigate('CrewMembers', { crewId: blocked[0].id })} /> : null}
          <Btn title="계정 삭제" kind="danger" disabled={!ok || blocked.length > 0} loading={del.isPending} onPress={() => del.mutate(undefined)} />
        </>
      }
    >
      <NavBar onBack={() => navigation.goBack()} />
      <View style={{ gap: 6 }}>
        <H1>계정을 삭제할까요?</H1>
        <Sub>삭제하면 되돌릴 수 없어요. 아래 내용을 확인해 주세요.</Sub>
      </View>
      <Glass style={{ borderRadius: 20, paddingVertical: 6, paddingHorizontal: 16 }}>
        {items.map(([a, b]) => (
          <View key={a} style={{ minHeight: 68, justifyContent: 'center', gap: 2, paddingVertical: 6 }}>
            <T size={15} weight="600">
              {a}
            </T>
            <T size={13} color={C.sub}>
              {b}
            </T>
          </View>
        ))}
      </Glass>
      <Tap noScale onPress={() => setOk(!ok)} style={{ minHeight: 48, paddingHorizontal: 4, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <CheckCircle on={ok} danger />
        <T size={15}>위 내용을 확인했어요</T>
      </Tap>
      <ErrorText error={del.error} />
    </Screen>
  );
}

