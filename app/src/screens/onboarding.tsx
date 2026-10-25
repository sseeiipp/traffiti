import { useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { api } from '../api/client';
import { useAction, useMe } from '../api/hooks';
import { SocialCancelled, socialCredential } from '../api/socialLogin';
import { MapBackdrop } from '../map/MapArt';
import type { P } from '../navigation/types';
import { useAuth, type Provider } from '../store/auth';
import { C, shadow } from '../theme';
import { IcLocate, IcPlus, IcCamera } from '../ui/icons';
import {
  Btn,
  CheckCircle,
  Chip,
  CodeCells,
  CrewAvatar,
  CrewPhoto,
  ErrorText,
  Field,
  Glass,
  H1,
  Handle,
  NavBar,
  Screen,
  Segmented,
  Sheet,
  Sub,
  T,
  Tap,
  TextLink,
  useBottom,
} from '../ui/kit';
import { HeroMap } from './common';

// ---------- 01 위치 권한 안내 · 시작 ----------

export function Intro() {
  const set = useAuth((s) => s.set);
  const b = useBottom();
  const next = async (ask: boolean) => {
    if (ask) {
      try {
        // 첫 실행에는 '앱 사용 중'만 요청한다. 백그라운드 위치는 첫 러닝 때 다시 물어본다
        await Location.requestForegroundPermissionsAsync();
      } catch {}
    }
    set({ introSeen: true });
  };
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ height: 340, overflow: 'hidden' }}>
        <HeroMap h={340} dot />
      </View>
      <Glass
        kind="sheet"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          maxHeight: '88%',
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          borderRadius: 0,
          paddingTop: 32,
          paddingHorizontal: 24,
          paddingBottom: b,
          gap: 22,
        }}
      >
        <View style={{ gap: 10 }}>
          <H1 size={26}>{'달린 길이 모여\n크루의 그림이 돼요'}</H1>
          <Sub>러닝 경로를 기록하려면 위치 정보가 필요해요. 이렇게만 사용해요.</Sub>
        </View>
        <View style={{ gap: 14 }}>
          {[
            ['러닝을 기록하는 동안에만', '기록 시작부터 종료까지의 경로만 저장해요.'],
            ['화면이 꺼져도 이어서', '주머니 속에서도 끊기지 않도록 백그라운드 위치를 사용해요.'],
            ['공개 범위는 챌린지마다 확인', '상세 경로를 누구에게 보여줄지 직접 정해요.'],
          ].map(([a, b2]) => (
            <View key={a} style={{ gap: 2 }}>
              <T size={15} weight="600">
                {a}
              </T>
              <T size={13} color={C.sub} lh={1.5}>
                {b2}
              </T>
            </View>
          ))}
        </View>
        <View style={{ marginTop: 'auto', gap: 10 }}>
          <Btn title="위치 사용 허용하기" onPress={() => next(true)} />
          <Btn title="나중에 할게요" kind="ghost" onPress={() => next(false)} height={48} textSize={15} style={{ backgroundColor: 'transparent' }} />
        </View>
      </Glass>
    </View>
  );
}

// ---------- 02 위치 권한 설정 안내 ----------

export function LocationNeeded({ navigation }: P<'LocationNeeded'>) {
  return (
    <View style={{ flex: 1 }}>
      <Svg width="100%" height="100%" viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice" style={StyleSheet.absoluteFill}>
        <MapBackdrop w={390} h={844} seed={3} />
        <Path
          transform="translate(45 100)"
          d="M30 100 L32 80 L50 62 L80 50 L110 42 L140 40 L170 42 L200 48 L222 62 L240 80 L250 100 L268 82 L290 70 L282 100 L290 130 L268 118 L250 110 L236 128 L210 142 L180 148 L140 150 L100 148 L66 140 L42 124 Z"
          stroke={C.ink}
          strokeWidth={5}
          fill="none"
          strokeLinejoin="round"
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(21, 23, 28, 0.22)' }]} />
      <Glass
        kind="sheet"
        intensity={50}
        style={{
          position: 'absolute',
          left: 10,
          right: 10,
          bottom: 10,
          borderRadius: 36,
          backgroundColor: 'rgba(255, 255, 255, 0.94)',
          paddingTop: 10,
          paddingHorizontal: 20,
          paddingBottom: 24,
          gap: 18,
          boxShadow: shadow.sheet,
        }}
      >
        <Handle />
        <View style={{ gap: 6 }}>
          <T size={22} weight="700" ls={-0.02}>
            러닝을 기록하려면 위치 권한이 필요해요
          </T>
          <T size={14} color={C.sub} lh={1.55}>
            처음에 허용하지 않으셨어요. 기록을 시작한 뒤부터 끝날 때까지만 위치를 사용해요.
          </T>
        </View>
        <Glass style={{ borderRadius: 20 }}>
          {['아래 버튼으로 설정 열기', "위치 → '앱을 사용하는 동안' 선택", "'정확한 위치' 켜기"].map((s, i) => (
            <View key={s} style={{ minHeight: 52, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: C.lime, alignItems: 'center', justifyContent: 'center' }}>
                <T size={12} weight="700" rounded>
                  {i + 1}
                </T>
              </View>
              <T size={14}>{s}</T>
            </View>
          ))}
        </Glass>
        <View style={{ gap: 8 }}>
          <Btn
            title="설정 열기"
            onPress={() => {
              if (Platform.OS === 'web') navigation.goBack();
              else Linking.openSettings();
            }}
          />
          <Btn title="지금은 둘러보기만 할게요" kind="secondary" onPress={() => navigation.goBack()} />
        </View>
      </Glass>
    </View>
  );
}

// ---------- 03-0 시작하기 · 로그인 방법 선택 ----------

export function AuthStart({ navigation }: P<'AuthStart'>) {
  const { deviceId, set, setTokens } = useAuth();
  const b = useBottom();
  const [err, setErr] = useState<unknown>(null);
  const social = async (provider: Provider) => {
    setErr(null);
    try {
      const cred = await socialCredential(provider, deviceId);
      const r = await api('/auth/social', { body: { provider, ...cred } });
      if (r.needsSignup) {
        set({ signup: { provider, cred, suggestedName: r.suggestedName } });
        navigation.navigate('Terms');
      } else setTokens(r);
    } catch (e) {
      if (!(e instanceof SocialCancelled)) setErr(e);
    }
  };
  const btn = { height: 52, borderRadius: 999, alignItems: 'center' as const, justifyContent: 'center' as const };
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ height: 380, overflow: 'hidden' }}>
        <HeroMap h={380} stroke={7} dy={100} />
      </View>
      <Glass
        kind="sheet"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          maxHeight: '88%',
          borderRadius: 0,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          paddingTop: 28,
          paddingHorizontal: 24,
          paddingBottom: b - 4,
          gap: 10,
        }}
      >
        <H1 size={26} style={{ marginBottom: 14 }}>
          {'크루와 함께 달려서\n그림을 그려요'}
        </H1>
        <Tap onPress={() => social('kakao')} style={[btn, { backgroundColor: '#FEE500' }]}>
          <View style={{ position: 'absolute', left: 20 }}>
            <Svg width={20} height={20} viewBox="0 0 24 24">
              <Path d="M12 3C6.5 3 2 6.5 2 10.8c0 2.8 1.9 5.2 4.7 6.6l-1 3.6c-.1.4.3.7.6.5l4.3-2.8c.5.1.9.1 1.4.1 5.5 0 10-3.5 10-7.9S17.5 3 12 3z" fill="#000000" />
            </Svg>
          </View>
          <T size={16} weight="600" color="rgba(0, 0, 0, 0.85)">
            카카오로 시작하기
          </T>
        </Tap>
        <Tap onPress={() => social('naver')} style={[btn, { backgroundColor: '#03C75A' }]}>
          <View style={{ position: 'absolute', left: 22 }}>
            <Svg width={16} height={16} viewBox="0 0 16 16">
              <Path d="M10.8 8.6 5 0H0v16h5.2V7.4L11 16h5V0h-5.2z" fill="#FFFFFF" />
            </Svg>
          </View>
          <T size={16} weight="600" color="#FFFFFF">
            네이버로 시작하기
          </T>
        </Tap>
        <Tap onPress={() => social('google')} style={[btn, { backgroundColor: '#FFFFFF', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1), 0 4px 14px rgba(0, 0, 0, 0.08)' }]}>
          <View style={{ position: 'absolute', left: 20 }}>
            <Svg width={18} height={18} viewBox="0 0 24 24">
              <Path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5c-.3 1.5-1.1 2.7-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.7z" />
              <Path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1C3.4 21.4 7.4 24 12 24z" />
              <Path fill="#FBBC05" d="M5.4 14.4c-.2-.7-.4-1.5-.4-2.4s.1-1.6.4-2.4V6.5H1.4C.5 8.2 0 10 0 12s.5 3.8 1.4 5.5l4-3.1z" />
              <Path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4C17.9 1.2 15.2 0 12 0 7.4 0 3.4 2.6 1.4 6.5l4 3.1c.9-2.8 3.5-4.8 6.6-4.8z" />
            </Svg>
          </View>
          <T size={16} weight="600">
            Google로 시작하기
          </T>
        </Tap>
        <Btn title="이메일로 로그인" kind="secondary" onPress={() => navigation.navigate('Login')} />
        <Tap
          noScale
          onPress={() => {
            set({ signup: { provider: 'email' } });
            navigation.navigate('Terms');
          }}
          style={{ alignSelf: 'center', minHeight: 40, justifyContent: 'center' }}
        >
          <T size={14} color={C.sub}>
            처음이에요?{' '}
            <T size={14} weight="600" color={C.limeText}>
              이메일로 가입
            </T>
          </T>
        </Tap>
        <ErrorText error={err} />
      </Glass>
    </View>
  );
}

// ---------- 03 로그인 ----------

export function Login({ navigation }: P<'Login'>) {
  const { setTokens, set } = useAuth();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const login = useAction((v: { email: string; password: string }) => api('/auth/login', { body: v }));
  return (
    <Screen
      gap={24}
      pad={24}
      footer={
        <>
          <Btn title="로그인" loading={login.isPending} onPress={() => login.mutate({ email, password: pw }, { onSuccess: setTokens })} />
          <Tap
            noScale
            onPress={() => {
              set({ signup: { provider: 'email' } });
              navigation.navigate('Terms');
            }}
            style={{ alignSelf: 'center', minHeight: 44, justifyContent: 'center' }}
          >
            <T size={14} color={C.sub}>
              처음이에요?{' '}
              <T size={14} weight="600" color={C.limeText}>
                회원가입
              </T>
            </T>
          </Tap>
        </>
      }
    >
      <NavBar onBack={() => navigation.goBack()} />
      <View style={{ gap: 8 }}>
        <H1>로그인</H1>
        <Sub>다시 만나서 반가워요.</Sub>
      </View>
      <View style={{ gap: 14 }}>
        <Field label="이메일" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
        <Field
          label="비밀번호"
          value={pw}
          onChangeText={setPw}
          secureTextEntry
          autoComplete="current-password"
          onSubmitEditing={() => login.mutate({ email, password: pw }, { onSuccess: setTokens })}
        />
        <ErrorText error={login.error} />
        <TextLink title="비밀번호를 잊으셨나요?" onPress={() => navigation.navigate('PasswordReset')} style={{ alignSelf: 'flex-end' }} />
      </View>
    </Screen>
  );
}

// ---------- 03-1 약관 동의 ----------

export function Terms({ navigation }: P<'Terms'>) {
  const { signup, set } = useAuth();
  const [s, setS] = useState({ tos: false, location: false, marketing: false });
  const all = s.tos && s.location && s.marketing;
  const ready = s.tos && s.location;
  const rows: [keyof typeof s, string, boolean, 'tos' | 'loc' | 'mkt'][] = [
    ['tos', '이용약관', true, 'tos'],
    ['location', '위치정보 이용', true, 'loc'],
    ['marketing', '소식 알림 받기', false, 'mkt'],
  ];
  return (
    <View style={{ flex: 1 }}>
      <Screen
        gap={22}
        pad={24}
        footer={
          <Btn
            title={ready ? '동의하고 계속하기' : '필수 약관에 동의해 주세요'}
            disabled={!ready}
            onPress={() => {
              set({ signup: { ...signup, provider: signup?.provider ?? 'email', terms: s } });
              navigation.navigate('Signup');
            }}
          />
        }
      >
        <NavBar onBack={() => navigation.goBack()} />
        <View style={{ gap: 8 }}>
          <H1 size={28}>{'시작하기 전에\n약관을 확인해 주세요'}</H1>
        </View>
        <View style={{ gap: 4 }}>
          <Tap
            onPress={() => setS({ tos: !all, location: !all, marketing: !all })}
            style={{
              minHeight: 60,
              borderRadius: 18,
              paddingLeft: 14,
              paddingRight: 16,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              backgroundColor: all ? 'rgba(163, 230, 53, 0.35)' : C.field,
            }}
          >
            <CheckCircle on={all} />
            <View style={{ flex: 1, gap: 1 }}>
              <T size={16} weight="700">
                약관 모두 동의
              </T>
              <T size={12} color={C.sub}>
                선택 항목도 함께 동의해요
              </T>
            </View>
          </Tap>
          {rows.map(([k, label, req, doc]) => (
            <View key={k} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 14, paddingRight: 4 }}>
              <Tap noScale onPress={() => setS({ ...s, [k]: !s[k] })} style={{ flex: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Svg width={20} height={20} viewBox="0 0 24 24">
                  <Path d="M4.5 12.5l5 5L19.5 7" stroke={s[k] ? C.toggle : '#C7C7CC'} strokeWidth={2.8} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
                <T size={15}>{label}</T>
                <T size={12} weight="600" color={req ? C.limeText : C.sub2}>
                  {req ? '필수' : '선택'}
                </T>
              </Tap>
              <Tap
                noScale
                onPress={() => navigation.navigate('TermsDetail', { doc })}
                label={`${label} 전문 보기`}
                style={{ height: 44, paddingHorizontal: 6, justifyContent: 'center' }}
              >
                <T size={13} color={C.sub2}>
                  보기 ›
                </T>
              </Tap>
            </View>
          ))}
        </View>
        <T size={13} color={C.sub} lh={1.5} style={{ marginHorizontal: 4 }}>
          위치정보는 러닝을 기록하는 동안에만 쓰고, 상세 경로는 기본으로 나만 봐요.
        </T>
      </Screen>
    </View>
  );
}

// ---------- 03-1-1 약관 전문 보기 ----------

// 시안용 문구. 출시 전 법무 확인 후 바꾼다.
const DOCS: Record<'tos' | 'loc' | 'mkt', { label: string; title: string; items: [string, string][] }> = {
  tos: {
    label: '이용약관',
    title: '이용약관',
    items: [
      ['제1조 (목적)', '이 약관은 트래비티가 제공하는 러닝 경로 기반 크루 서비스의 이용 조건과 절차, 이용자와 서비스의 권리와 의무를 정하는 것을 목적으로 해요.'],
      ['제2조 (계정)', '이용자는 카카오, 네이버, Google 또는 이메일로 가입할 수 있어요. 계정 정보는 본인이 관리하며, 다른 사람에게 넘기거나 빌려줄 수 없어요.'],
      ['제3조 (크루와 챌린지)', '크루원은 챌린지 기간 안에 각자 달린 기록으로 하나의 작품을 함께 만들어요. 크루장은 챌린지 중단과 크루 운영에 필요한 권한을 가져요.'],
      ['제4조 (콘텐츠)', '이용자가 올린 사진, 크루 이름, 그림 이름은 이용자에게 책임이 있어요. 부적절한 콘텐츠는 신고되면 운영팀이 확인하고 숨기거나 삭제할 수 있어요.'],
      ['제5조 (계정 삭제)', '이용자는 언제든 계정을 삭제할 수 있어요. 삭제하면 러닝 기록과 GPS 경로는 지워지고, 크루 작품의 내 구간은 이름만 "나간 크루원"으로 바뀌어 남아요.'],
    ],
  },
  loc: {
    label: '위치정보 이용',
    title: '위치정보 이용',
    items: [
      ['수집 목적', '러닝 경로를 기록하고 챌린지 그림에 반영하며, 근처 코스와 지역을 보여주기 위해 위치정보를 이용해요.'],
      ['수집 시점', '러닝을 기록하는 동안에만 위치정보를 수집해요. 화면이 꺼져도 이어서 기록하기 위해 기록 중에는 백그라운드 위치를 사용해요.'],
      ['공개 범위', '상세 GPS 경로는 기본으로 나만 볼 수 있어요. 완성 작품은 기본으로 크루원에게만 보여요. 챌린지마다 따로 바꿀 수 있어요.'],
      ['보관과 삭제', '기록은 이용자가 삭제하거나 계정을 삭제할 때까지 보관해요. 공유 이미지에는 정확한 출발 지점과 도로명을 기본으로 숨겨요.'],
      ['동의 철회', '위치 권한은 기기 설정에서 언제든 바꿀 수 있어요. 허용하지 않아도 앱을 둘러볼 수 있지만 러닝은 기록할 수 없어요.'],
    ],
  },
  mkt: {
    label: '소식 알림',
    title: '소식 알림 받기',
    items: [
      ['받는 소식', '새 챌린지, 이어 달리기 요청, 작품 완성, 새 그림 세트 같은 서비스 소식을 알림으로 보내요.'],
      ['선택 동의', '이 항목은 선택이에요. 동의하지 않아도 서비스를 이용할 수 있고, 챌린지 진행에 꼭 필요한 알림은 별도로 보내요.'],
      ['바꾸기', '내 설정의 알림에서 언제든 켜고 끌 수 있어요.'],
    ],
  },
};

export function TermsDetail({ navigation, route }: P<'TermsDetail'>) {
  const [doc, setDoc] = useState(route.params.doc);
  const d = DOCS[doc];
  return (
    <Screen gap={18} pad={24} footer={<Btn title="확인했어요" onPress={() => navigation.goBack()} />}>
      <NavBar onBack={() => navigation.goBack()} />
      <H1 size={28}>{d.title}</H1>
      <Segmented small items={(Object.keys(DOCS) as (keyof typeof DOCS)[]).map((k) => ({ key: k, label: DOCS[k].label }))} value={doc} onChange={setDoc} />
      <View style={{ gap: 18 }}>
        {d.items.map(([h, b]) => (
          <View key={h} style={{ gap: 6 }}>
            <T size={15} weight="700">
              {h}
            </T>
            <T size={14} color={C.body2} lh={1.65}>
              {b}
            </T>
          </View>
        ))}
      </View>
    </Screen>
  );
}

// ---------- 03-2 회원가입 ----------

const PROVIDER_LABEL: Record<Provider, string> = { email: '이메일', kakao: '카카오', naver: '네이버', google: 'Google' };

export function Signup({ navigation }: P<'Signup'>) {
  const { signup, deviceId, setTokens, set } = useAuth();
  const provider = signup?.provider ?? 'email';
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [name, setName] = useState(signup?.suggestedName ?? '');
  const go = useAction(async () => {
    const terms = signup?.terms ?? { tos: false, location: false, marketing: false };
    const cred = signup?.cred ?? { subject: `${provider}:${deviceId}` };
    const r =
      provider === 'email'
        ? await api('/auth/signup', { body: { email, password: pw, name, terms } })
        : await api('/auth/social', { body: { provider, ...cred, signup: { name, terms } } });
    set({ signup: null });
    setTokens(r);
  });
  return (
    <Screen
      gap={18}
      pad={24}
      footer={
        <>
          <Btn title="가입하기" loading={go.isPending} onPress={() => go.mutate(undefined)} />
          <Tap noScale onPress={() => navigation.navigate('Login')} style={{ alignSelf: 'center', minHeight: 44, justifyContent: 'center' }}>
            <T size={14} color={C.sub}>
              이미 계정이 있나요?{' '}
              <T size={14} weight="600" color={C.limeText}>
                로그인
              </T>
            </T>
          </Tap>
        </>
      }
    >
      <NavBar onBack={() => navigation.goBack()} />
      <View style={{ gap: 6 }}>
        <H1>회원가입</H1>
      </View>
      <View style={{ gap: 12 }}>
        <Field label="크루에서 쓸 이름" height={50} value={name} onChangeText={(t) => setName(t.slice(0, 10))} />
        {provider === 'email' ? (
          <>
            <Field label="이메일" height={50} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
            <Field label="비밀번호" height={50} value={pw} onChangeText={setPw} secureTextEntry autoComplete="new-password" />
          </>
        ) : (
          <View style={{ minHeight: 52, borderRadius: 16, backgroundColor: C.field, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <T size={15} weight="600" style={{ flex: 1 }}>
              {PROVIDER_LABEL[provider]} 계정으로 가입해요
            </T>
            <T size={13} color={C.sub}>
              이메일·비밀번호 없이
            </T>
          </View>
        )}
        <ErrorText error={go.error} />
      </View>
    </Screen>
  );
}

// ---------- 04 비밀번호 재설정 ----------

export function PasswordReset({ navigation }: P<'PasswordReset'>) {
  const me = useMe();
  const [step, setStep] = useState<'request' | 'sent' | 'new'>('request');
  const [email, setEmail] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (me.data?.email) setEmail(me.data.email);
  }, [me.data?.email]);
  const send = useAction(async () => {
    const r = await api('/auth/password/reset', { body: { email } });
    setToken(r.devToken ?? null);
    setStep('sent');
  });
  const confirm = useAction(async () => {
    if (pw !== pw2) throw new Error('두 비밀번호가 달라요.');
    const r = await api('/auth/password/confirm', { body: { token, password: pw } });
    if (!r.ok) throw new Error(r.message);
    navigation.goBack();
  });
  return (
    <Screen
      gap={22}
      pad={24}
      footer={step === 'request' ? <Btn title="재설정 링크 보내기" loading={send.isPending} onPress={() => send.mutate(undefined)} /> : undefined}
    >
      <NavBar onBack={() => navigation.goBack()} />
      {step === 'request' ? (
        <View style={{ gap: 22 }}>
          <View style={{ gap: 8 }}>
            <H1>비밀번호 재설정</H1>
            <Sub>가입한 이메일로 재설정 링크를 보내드려요.</Sub>
          </View>
          <Field label="이메일" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
          <ErrorText error={send.error} />
        </View>
      ) : step === 'sent' ? (
        <View style={{ gap: 22 }}>
          <View style={{ gap: 8 }}>
            <H1>메일을 보냈어요</H1>
            <Sub>{email} 받은편지함에서 링크를 눌러 새 비밀번호를 정해 주세요. 메일이 없으면 스팸함도 확인해 주세요.</Sub>
          </View>
          <View style={{ gap: 8 }}>
            <Btn
              title="링크를 열었어요"
              onPress={() => {
                // 메일 발송 연동 전: 개발 서버가 돌려준 링크 토큰으로 바로 이어간다
                if (token) setStep('new');
                else setErr('가입한 이메일이 아니거나 메일 발송이 아직 연결되지 않았어요.');
              }}
            />
            <Btn title="메일 다시 보내기" kind="secondary" onPress={() => send.mutate(undefined)} />
            {err ? (
              <T size={13} color={C.danger}>
                {err}
              </T>
            ) : null}
          </View>
        </View>
      ) : (
        <View style={{ gap: 18 }}>
          <H1>새 비밀번호 정하기</H1>
          <Field label="새 비밀번호" value={pw} onChangeText={setPw} secureTextEntry />
          <Field label="한 번 더 입력" value={pw2} onChangeText={setPw2} secureTextEntry />
          <Btn title="변경하고 로그인" loading={confirm.isPending} onPress={() => confirm.mutate(undefined)} />
          <ErrorText error={confirm.error} />
        </View>
      )}
    </Screen>
  );
}

// ---------- 05 크루 만들기 · 참여 ----------

/** 역지오코딩 결과에서 '구 동'을 뽑는다. 기기마다 담기는 칸이 달라 모든 칸을 훑는다 */
function areaName(a: Location.LocationGeocodedAddress): { key: string; full: string } | null {
  const parts = [a.district, a.subregion, a.city, a.street, a.name, a.region].filter((p): p is string => !!p).flatMap((p) => p.split(' '));
  const gu = parts.find((p) => /(구|군)$/.test(p)) ?? parts.find((p) => /시$/.test(p) && !/(특별|광역)시$/.test(p)) ?? '';
  const raw = parts.find((p) => /(동|읍|면|\d가|리)$/.test(p)) ?? '';
  const dong = raw.replace(/^(.+?동)\d*가$/, '$1').replace(/^(.+?)\d+동$/, '$1동');
  const key = dong || gu;
  if (!key) return null;
  return { key, full: [gu, dong].filter(Boolean).join(' ') };
}

export function CrewSetup({ navigation, route }: P<'CrewSetup'>) {
  const qc = useQueryClient();
  const setAuth = useAuth((s) => s.set);
  const [mode, setMode] = useState<'join' | 'create'>(route.params?.mode ?? 'join');
  const [code, setCode] = useState('');
  const [preview, setPreview] = useState<any>(null);
  const [previewErr, setPreviewErr] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [photo, setPhoto] = useState(false);
  const [area, setArea] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  // 주로 달리는 지역: 지금 위치와 주변 네 방향(약 1.5km)을 동 이름으로 바꿔 고른다
  const [AREAS, setAreas] = useState<{ key: string; full: string }[]>([]);
  const [locating, setLocating] = useState(false);
  const [locErr, setLocErr] = useState<string | null>(null);
  const [typedArea, setTypedArea] = useState('');
  const locate = async () => {
    setLocating(true);
    setLocErr(null);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) throw new Error('위치 권한을 허용하면 지금 지역을 찾아 드려요. 직접 입력해도 돼요.');
      const { coords } = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const d = 0.0135;
      const pts = [
        [0, 0],
        [d, 0],
        [-d, 0],
        [0, d * 1.25],
        [0, -d * 1.25],
      ];
      const found: { key: string; full: string }[] = [];
      for (const [dy, dx] of pts) {
        const [a] = await Location.reverseGeocodeAsync({ latitude: coords.latitude + dy, longitude: coords.longitude + dx }).catch(() => []);
        const r = a ? areaName(a) : null;
        if (r && !found.some((f) => f.key === r.key)) found.push(r);
      }
      if (!found.length) throw new Error('지금 위치의 지역 이름을 찾지 못했어요. 직접 입력해 주세요.');
      setAreas(found);
      setArea(0);
    } catch (e) {
      setLocErr((e as Error).message || '위치를 찾지 못했어요. 직접 입력해 주세요.');
    } finally {
      setLocating(false);
    }
  };
  useEffect(() => {
    if (mode === 'create' && !AREAS.length && !locating && !locErr) locate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);
  const region = AREAS[area]?.full ?? typedArea.trim();

  useEffect(() => {
    setPreview(null);
    setPreviewErr(null);
    if (code.length !== 6) return;
    api('/crews/preview-code', { body: { code } })
      .then(setPreview)
      .catch((e) => setPreviewErr(e.message));
  }, [code]);

  const done = async (crewId: number) => {
    setAuth({ crewId });
    await qc.invalidateQueries({ queryKey: ['crews'] });
  };
  const join = useAction(async () => {
    const r = await api('/crews/join-by-code', { body: { code } });
    if (r.status === 'requested') {
      setNotice(`${r.name} 크루장에게 가입을 요청했어요. 수락되면 크루원이 돼요.`);
      return;
    }
    await done(r.crewId);
    navigation.reset({ index: 0, routes: [{ name: 'Tabs' }] });
  });
  const create = useAction(async () => {
    const r = await api('/crews', { body: { name, hasPhoto: photo, region } });
    await done(r.id);
    navigation.reset({ index: 1, routes: [{ name: 'Tabs' }, { name: 'CrewInvite', params: { crewId: r.id } }] });
  });

  const ready = mode === 'create' ? name.trim().length > 0 && !!region : !!preview;
  const cta = mode === 'join' ? (preview ? `${preview.name}에 참여하기` : '코드를 넣어 주세요') : '크루 만들고 초대하기';
  return (
    <Screen
      top={64}
      pad={24}
      gap={18}
      footer={
        <Btn title={cta} disabled={!ready} loading={join.isPending || create.isPending} onPress={() => (mode === 'join' ? join.mutate(undefined) : create.mutate(undefined))} />
      }
    >
      {navigation.canGoBack() ? <NavBar onBack={() => navigation.goBack()} kind="close" /> : null}
      <View style={{ gap: 8 }}>
        <H1 size={26}>함께 달릴 크루를 정해요</H1>
      </View>
      <Segmented
        items={[
          { key: 'join', label: '초대 코드로 참여' },
          { key: 'create', label: '새 크루 만들기' },
        ]}
        value={mode}
        onChange={setMode}
      />
      {mode === 'join' ? (
        <View style={{ gap: 16 }}>
          <View style={{ gap: 8 }}>
            <T size={13} weight="600">
              초대 코드 6자리
            </T>
            <CodeCells value={code} onChange={setCode} label="초대 코드 6자리 숫자" />
            <T size={13} color={preview ? C.limeText : previewErr ? C.danger : C.sub}>
              {preview ? '이 크루가 맞나요?' : (previewErr ?? '크루장에게 받은 숫자 6자리를 넣어 주세요.')}
            </T>
          </View>
          {preview ? (
            <Glass style={{ borderRadius: 20, paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <CrewAvatar crew={preview} size={40} radius={12} />
              <View style={{ gap: 2 }}>
                <T size={15} weight="600">
                  {preview.name}
                </T>
                <T size={12} color={C.sub}>
                  크루원 {preview.members}명 · 진행 중 챌린지 {preview.active}개{preview.joinPolicy === 'approve' ? ' · 크루장 승인 후 가입' : ''}
                </T>
              </View>
            </Glass>
          ) : null}
          {notice ? (
            <T size={14} color={C.limeText} lh={1.5}>
              {notice}
            </T>
          ) : null}
          <ErrorText error={join.error} />
          <TextLink
            title="크루 없이 하기"
            onPress={() => {
              useAuth.getState().set({ crewSkipped: true });
              navigation.reset({ index: 0, routes: [{ name: 'Tabs' }] });
            }}
            style={{ alignSelf: 'flex-start' }}
          />
        </View>
      ) : (
        <View style={{ gap: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <Tap
              onPress={() => setPhoto(!photo)}
              label="크루 사진 선택"
              style={{ width: 84, height: 84, borderRadius: 24, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', boxShadow: shadow.soft }}
            >
              {photo ? <CrewPhoto size={84} radius={24} /> : <IcCamera size={30} color={C.sub} w={1.8} />}
              <View
                style={{
                  position: 'absolute',
                  right: -4,
                  bottom: -4,
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  backgroundColor: C.lime,
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 0 3px #FFFFFF',
                }}
              >
                <IcPlus size={14} w={3} />
              </View>
            </Tap>
            <T size={16} weight="600" style={{ flex: 1 }}>
              {photo ? '사진을 넣었어요' : '크루 사진 넣기'}
            </T>
          </View>
          <Field label="크루 이름" value={name} onChangeText={(t) => setName(t.slice(0, 16))} />
          <View style={{ gap: 8 }}>
            <T size={13} weight="600">
              주로 달리는 지역
            </T>
            <Glass style={{ borderRadius: 20, paddingVertical: 14, paddingLeft: 16, paddingRight: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ flex: 1, gap: 2 }}>
                {AREAS.length ? (
                  <>
                    <T size={17} weight="600">
                      {AREAS[area].full}
                    </T>
                    <T size={13} color={C.sub}>
                      {area === 0 ? '지금 위치에서 찾았어요' : '지금 위치 근처 지역'}
                    </T>
                  </>
                ) : locating ? (
                  <T size={15} color={C.sub}>
                    지금 위치를 찾고 있어요
                  </T>
                ) : (
                  <Field value={typedArea} onChangeText={(t) => setTypedArea(t.slice(0, 24))} placeholder="예: 성동구 성수동" height={44} />
                )}
              </View>
              <Tap
                onPress={() => (AREAS.length ? setArea(0) : locate())}
                label="현재 위치로 다시 찾기"
                style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', boxShadow: shadow.soft }}
              >
                <IcLocate size={20} />
              </Tap>
            </Glass>
            {locErr ? (
              <T size={13} color={C.sub} lh={1.5}>
                {locErr}
              </T>
            ) : null}
            {AREAS.length > 1 ? (
              <>
                <T size={13} color={C.sub}>
                  근처 지역
                </T>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {AREAS.map((a, i) => (
                    <Chip key={a.key} label={a.key} on={i === area} onPress={() => setArea(i)} />
                  ))}
                </View>
              </>
            ) : null}
          </View>
          <ErrorText error={create.error} />
        </View>
      )}
    </Screen>
  );
}
