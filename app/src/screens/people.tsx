import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { api } from '../api/client';
import { useAction } from '../api/hooks';
import { ShapeGlyph } from '../map/MapArt';
import { shapeLabel } from '../map/shapes';
import type { P } from '../navigation/types';
import { C, font } from '../theme';
import { IcClose, IcMore, IcSearch } from '../ui/icons';
import { Avatar, ErrorText, Glass, H1, Loading, NavBar, RoundBtn, Screen, T, Tap } from '../ui/kit';
import { IcFlag, ReportSheet } from './results';

// ---------- 32 유저 찾기 · 초대 ----------

interface PersonRow {
  id: number;
  name: string;
  crew: string;
  color: string;
  invited: boolean;
  member: boolean;
}

export function UserSearch({ navigation, route }: P<'UserSearch'>) {
  const crewId = route.params.crewId;
  const [q, setQ] = useState('');
  const term = q.trim();
  const people = useQuery({
    queryKey: ['people', crewId, term],
    queryFn: () => api<PersonRow[]>(`/users/search?crewId=${crewId}&q=${encodeURIComponent(term)}`),
  });
  const invite = useAction(({ id, on }: { id: number; on: boolean }) => api(`/crews/${crewId}/invites/users/${id}`, { body: { on } }), [['people']]);
  const rows = people.data ?? [];
  return (
    <Screen gap={14}>
      <NavBar onBack={() => navigation.goBack()} />
      <H1>유저 찾기</H1>
      <View style={{ height: 48, borderRadius: 14, backgroundColor: C.field, paddingLeft: 14, paddingRight: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <IcSearch size={18} />
        <TextInput
          value={q}
          onChangeText={(t) => setQ(t.slice(0, 20))}
          placeholder="이름으로 찾기"
          placeholderTextColor={C.sub3}
          accessibilityLabel="유저 이름 검색"
          style={[{ flex: 1, fontSize: 16, color: C.ink, fontFamily: font.text }, Platform.OS === 'web' && ({ outlineStyle: 'none' } as any)]}
        />
        {q ? (
          <Tap noScale label="검색어 지우기" onPress={() => setQ('')} style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
            <IcClose size={16} color={C.sub2} w={2.4} />
          </Tap>
        ) : null}
      </View>
      <T size={13} weight="600" color={C.sub} style={{ marginTop: 6, marginLeft: 4 }}>
        {term ? `검색 결과 ${rows.length}` : '함께 달린 적 있는 사람'}
      </T>
      {rows.length ? (
        <Glass style={{ borderRadius: 20, paddingVertical: 4, paddingLeft: 16, paddingRight: 8 }}>
          {rows.map((u) => (
            <View key={u.id} style={{ minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Pressable onPress={() => navigation.navigate('UserProfile', { userId: u.id })} style={{ flex: 1, minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Avatar letter={u.name.slice(0, 1)} color={u.color} size={44} />
                <View style={{ flex: 1, gap: 2 }}>
                  <T size={16} weight="600">
                    {u.name}
                  </T>
                  <T size={13} color={C.sub}>
                    {u.crew}
                  </T>
                </View>
              </Pressable>
              {u.member ? (
                <T size={13} color={C.sub} style={{ paddingHorizontal: 8 }}>
                  크루원
                </T>
              ) : (
                <Tap
                  label={u.invited ? `${u.name}님에게 초대를 보냈어요` : `${u.name}님 초대하기`}
                  onPress={() => invite.mutate({ id: u.id, on: !u.invited })}
                  style={{ height: 36, paddingHorizontal: 16, borderRadius: 999, justifyContent: 'center', backgroundColor: u.invited ? '#ECFCCB' : C.lime }}
                >
                  <T size={14} weight="600" color={u.invited ? C.limeText : C.ink}>
                    {u.invited ? '초대함' : '초대'}
                  </T>
                </Tap>
              )}
            </View>
          ))}
        </Glass>
      ) : people.isLoading ? null : (
        <View style={{ marginTop: 40, alignItems: 'center', gap: 6 }}>
          <T size={17} weight="700">
            찾는 사람이 없어요
          </T>
          <T size={14} color={C.sub} lh={1.5}>
            이름을 다시 확인해 주세요.
          </T>
        </View>
      )}
      <ErrorText error={invite.error} />
    </Screen>
  );
}

// ---------- 33 유저 프로필 · 신고 ----------

interface PersonProfile {
  id: number;
  name: string;
  isMe: boolean;
  color: string;
  primaryCrew: { id: number; name: string } | null;
  monthKm: number;
  completedArtworks: number;
  crewLevel: number | null;
  together: { id: number; shapeKey: string; name: string | null; color: string }[];
}

/** 대표 크루 · 이번 달 거리 · 완성 작품만 보이고, 상세 경로는 본인이 공개한 만큼만 */
export function UserProfile({ navigation, route }: P<'UserProfile'>) {
  const p = useQuery({ queryKey: ['person', route.params.userId], queryFn: () => api<PersonProfile>(`/users/${route.params.userId}/profile`) });
  const [menu, setMenu] = useState(false);
  const [report, setReport] = useState(false);
  if (!p.data) return <Loading />;
  const u = p.data;
  return (
    <View style={{ flex: 1 }}>
      <Screen gap={16}>
        <NavBar
          onBack={() => navigation.goBack()}
          right={
            u.isMe ? null : (
              <RoundBtn kind="custom" label="더 보기" onPress={() => setMenu(!menu)}>
                <IcMore />
              </RoundBtn>
            )
          }
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <Avatar letter={u.name.slice(0, 1)} color={u.color} size={72} />
          <View style={{ flex: 1, gap: 3 }}>
            <T size={28} weight="700" ls={-0.02}>
              {u.name}
            </T>
            <T size={14} color={C.sub}>
              {u.primaryCrew ? `대표 크루 · ${u.primaryCrew.name}` : '대표 크루 없음'}
            </T>
          </View>
        </View>
        <View style={{ flexDirection: 'row', paddingVertical: 12, borderRadius: 18, backgroundColor: C.soft }}>
          {[
            [`${u.monthKm}km`, '이번 달 거리'],
            [String(u.completedArtworks), '완성 작품'],
            [u.crewLevel ? `Lv ${u.crewLevel}` : '–', '크루 레벨'],
          ].map(([v, l]) => (
            <View key={l} style={{ flex: 1, alignItems: 'center', gap: 1 }}>
              <T size={20} weight="700" rounded>
                {v}
              </T>
              <T size={12} color={C.sub}>
                {l}
              </T>
            </View>
          ))}
        </View>
        {u.together.length ? (
          <View style={{ gap: 8 }}>
            <T size={17} weight="700" style={{ marginHorizontal: 2 }}>
              함께 만든 작품
            </T>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {u.together.slice(0, 3).map((w) => (
                <Tap key={w.id} onPress={() => navigation.navigate('Artwork', { challengeId: w.id })} style={{ flex: 1, maxWidth: '33%' }}>
                  <Glass style={{ borderRadius: 18, padding: 6, gap: 6 }}>
                    <ShapeGlyph shape={w.shapeKey} w="100%" h={64} color={w.color} bg={C.map.land} radius={12} />
                    <T size={12} weight="600" style={{ paddingHorizontal: 4, paddingBottom: 2 }}>
                      {w.name ?? shapeLabel(w.shapeKey)}
                    </T>
                  </Glass>
                </Tap>
              ))}
            </View>
          </View>
        ) : null}
        <T size={13} color={C.sub} lh={1.5} style={{ marginHorizontal: 4 }}>
          상세 경로는 본인이 공개한 만큼만 보여요.
        </T>
      </Screen>
      {menu ? (
        <>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setMenu(false)} />
          <View
            style={{
              position: 'absolute',
              right: 20,
              top: 104,
              width: 200,
              padding: 6,
              borderRadius: 18,
              backgroundColor: '#FFFFFF',
              boxShadow: '0 0 0 0.5px rgba(0, 0, 0, 0.06), 0 12px 32px rgba(0, 0, 0, 0.16)',
              zIndex: 10,
            }}
          >
            <Pressable
              accessibilityRole="menuitem"
              onPress={() => {
                setMenu(false);
                setReport(true);
              }}
              style={{ minHeight: 44, paddingHorizontal: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}
            >
              <IcFlag />
              <T size={15} weight="500" color={C.danger}>
                이 유저 신고하기
              </T>
            </Pressable>
          </View>
        </>
      ) : null}
      <ReportSheet open={report} kind="user" id={u.id} name={u.name} onClose={() => setReport(false)} />
    </View>
  );
}
