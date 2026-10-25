import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { api } from '../api/client';
import { useAction, useChallenge, useCrew, useMe, useRun as useRunQuery, useUnit, type Challenge } from '../api/hooks';
import { RouteArt, type LatLng } from '../map/MapArt';
import type { P } from '../navigation/types';
import { START_SPOTS } from '../store/draft';
import { newClientId, useRun } from '../store/run';
import { densify, distanceOf, finishRun, haversine, simulationPath, SIMULATE, uploadPending } from '../run/engine';
import { C } from '../theme';
import { IcChevron, IcLocate, IcPlay, IcPause } from '../ui/icons';
import {
  Avatar,
  Btn,
  Chip,
  ErrorText,
  Field,
  Glass,
  H1,
  Loading,
  NavBar,
  ProgressBar,
  RoundBtn,
  Screen,
  Stat,
  Sub,
  T,
  Tap,
  useBottom,
  useTop,
} from '../ui/kit';
import { clock, fmtKm, hm, kmParts, md, Measure, pace, partsOf, pct } from './common';
import { CourseMenu } from './courseMenu';

// ---------- 14 챌린지 상세 · 참여 ----------

export function ChallengeJoin({ navigation, route }: P<'ChallengeJoin'>) {
  const unit = useUnit();
  const top = useTop();
  const b = useBottom();
  const ch = useChallenge(route.params.challengeId);
  const crew = useCrew(ch.data?.crewId);
  if (!ch.data) return <Loading />;
  const c = ch.data;
  const active = c.status === 'active';
  const leader = crew.data?.myRole === 'leader';
  // 인원수로 1/n씩 나눈 내 구간. 지도에 내 색으로 굵게 겹쳐 미리 보여준다
  const mine = active ? c.plan?.find((p) => p.isMe) : undefined;
  const myLeg = mine ? { points: c.route.slice(mine.fromSeg, mine.toSeg + 1), color: mine.color } : null;
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Measure height={360}>{(w) => <RouteArt route={c.route} segments={c.segments} w={w} h={360} pad={44} seed={c.id} leg={myLeg} />}</Measure>
      <RoundBtn onPress={() => navigation.goBack()} style={{ position: 'absolute', left: 16, top: top + 2 }} />
      <CourseMenu
        c={c}
        onDeleted={() => navigation.goBack()}
        extra={active && leader ? { title: '챌린지 중단', onPress: () => navigation.navigate('ChallengeStop', { challengeId: c.id }) } : undefined}
        style={{ position: 'absolute', right: 16, top: top + 2 }}
      />
      <Glass kind="sheet" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '88%', borderRadius: 0, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 26, paddingHorizontal: 20, paddingBottom: b, gap: 18 }}>
        <View style={{ gap: 4 }}>
          <H1 size={26}>{c.title}</H1>
          <T size={13} color={C.sub}>
            {c.isFriend ? '친구 챌린지' : c.crewName} · {c.creatorName}님이 만들었어요
          </T>
        </View>
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <T size={13} color={C.sub}>
              {c.isFriend ? '함께 그린 정도' : '크루 누적 진행률'}
            </T>
            <T size={22} weight="700" rounded>
              {pct(c.progress)}
            </T>
          </View>
          <ProgressBar parts={partsOf(c.contributors)} />
        </View>
        <Glass style={{ borderRadius: 20 }}>
          {[
            ['기간', `${md(c.startAt)} – ${md(c.endAt)}${active ? ` · ${c.daysLeft}일 남음` : ''}`],
            ['남은 구간', `${fmtKm(c.remainingKm, unit)} / ${fmtKm(c.distanceKm, unit)}`],
            ['내 상세 경로', c.gpsVisibility === 'crew' ? '크루원' : '나만 보기'],
          ].map(([l, v]) => (
            <View key={l} style={{ minHeight: 50, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <T size={14} color={C.sub}>
                {l}
              </T>
              <T size={14} weight="600" rounded={l === '남은 구간'}>
                {v}
              </T>
            </View>
          ))}
        </Glass>
        {mine && c.plan.length > 0 ? (
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <T size={15} weight="700">
                내 구간 · {mine.part}
              </T>
              <T size={13} color={C.sub} rounded>
                {c.plan.length}명이 1/{c.plan.length}씩 · {fmtKm(mine.km, unit)}
              </T>
            </View>
            {/* 경로 순서대로 나눈 구간. 내 구간만 진하게 */}
            <View style={{ flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', gap: 2 }}>
              {c.plan.map((p) => (
                <View key={p.userId} style={{ flex: Math.max(1, p.toSeg - p.fromSeg), backgroundColor: p.color, opacity: p.isMe ? 1 : 0.3 }} />
              ))}
            </View>
            <T size={13} color={C.sub} lh={1.5}>
              {mine.remainingKm > 0
                ? `지도에 굵게 표시한 ${mine.order}번째 구간이 내가 맡은 곳이에요. 아직 ${fmtKm(mine.remainingKm, unit)} 남았어요.`
                : `${mine.order}번째 구간을 다 채웠어요. 남은 다른 구간을 도와도 좋아요.`}
            </T>
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ flexDirection: 'row' }}>
            {c.contributors.slice(0, 5).map((p, i) => (
              <Avatar key={String(p.userId)} letter={p.name.slice(0, 1)} color={p.color} size={28} style={{ marginLeft: i ? -8 : 0, borderWidth: 2, borderColor: '#FFFFFF' }} />
            ))}
          </View>
          <T size={13} color={C.sub}>
            {c.contributors.length ? `${c.contributors.length}명이 함께 그리고 있어요` : '아직 아무도 달리지 않았어요. 첫 구간을 채워 주세요.'}
          </T>
        </View>
        {active ? (
          <Btn title="참여하고 러닝 시작" icon={<IcPlay />} style={{ marginTop: 'auto' }} onPress={() => navigation.navigate('Running', { challengeId: c.id })} />
        ) : (
          <Btn title={c.status === 'completed' ? '완성 작품 보기' : '보관한 작품 보기'} style={{ marginTop: 'auto' }} onPress={() => navigation.replace('Artwork', { challengeId: c.id })} />
        )}
      </Glass>
    </View>
  );
}

// ---------- 15 GPS 러닝 · 일시정지 · 재개 ----------

/**
 * 달리는 중 내 구간(1/n): 지도에 굵게 그릴 점, 시작점까지 거리(구간 밖일 때), 채운 비율.
 * 채운 구간은 서버에 저장된 것 + 이번 러닝에서 30m 안으로 지나간 것.
 */
function legProgress(c: Challenge | undefined, trail: LatLng[], here: LatLng | null) {
  const mine = c?.status === 'active' ? c.plan?.find((p) => p.isMe) : undefined;
  if (!c || !mine || mine.toSeg <= mine.fromSeg) return null;
  const points = c.route.slice(mine.fromSeg, mine.toSeg + 1);
  const recent = trail.length > 600 ? trail.filter((_, i) => i % Math.ceil(trail.length / 600) === 0 || i === trail.length - 1) : trail;
  let filled = 0;
  for (let i = mine.fromSeg; i < mine.toSeg; i++) {
    if (c.segments[i]) {
      filled++;
      continue;
    }
    const a = c.route[i], b = c.route[i + 1];
    const mid: LatLng = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    if (recent.some((p) => haversine(p, mid) <= 30)) filled++;
  }
  const total = mine.toSeg - mine.fromSeg;
  // 구간 위에 있으면(어느 점이든 40m 안) 진행률, 아니면 시작점까지 거리
  const onLeg = here ? points.some((p) => haversine(p, here) <= 40) : false;
  return {
    points,
    color: mine.color,
    part: mine.part,
    done: filled / total,
    leftKm: Math.round(((total - filled) * 20) / 100) / 10,
    toStartM: here && !onLeg && filled < total ? Math.round(haversine(here, points[0])) : null,
  };
}

export function Running({ navigation, route }: P<'Running'>) {
  const unit = useUnit();
  const top = useTop();
  const b = useBottom();
  const challengeId = route.params.challengeId;
  const ch = useChallenge(challengeId);
  const crew = useCrew(ch.data?.crewId);
  const session = useRun((s) => s.session);
  const [arm, setArm] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [now, setNow] = useState(Date.now());
  const sim = useRef<{ path: LatLng[]; i: number; t: number } | null>(null);

  const myColor = ch.data?.myColor ?? crew.data?.members.find((m) => m.isMe)?.color ?? '#7A5AF8';

  // 러닝 시작(이미 같은 챌린지의 기록이 있으면 이어서)
  useEffect(() => {
    const cur = useRun.getState().session;
    if (!cur || cur.challengeId !== challengeId) useRun.getState().start({ clientId: newClientId(), challengeId, simulated: SIMULATE });
  }, [challengeId]);

  // 위치 받기
  useEffect(() => {
    if (!session || session.simulated) return;
    let sub: Location.LocationSubscription | null = null;
    let cancelled = false;
    (async () => {
      const p = await Location.requestForegroundPermissionsAsync();
      if (!p.granted) {
        navigation.replace('LocationNeeded', { then: 'run' });
        return;
      }
      if (cancelled) return;
      sub = await Location.watchPositionAsync({ accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 5, timeInterval: 2000 }, (l) =>
        useRun.getState().addPoint({ lat: l.coords.latitude, lng: l.coords.longitude, t: l.timestamp, accuracy: l.coords.accuracy ?? null }),
      );
    })();
    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [session?.clientId, session?.simulated, navigation]);

  // 시연용 가짜 위치: 비어 있는 구간을 따라 2.5m/s로(화면에서는 빠르게) 움직인다
  useEffect(() => {
    if (!session?.simulated) return;
    if (challengeId && !ch.data) return;
    if (!sim.current) {
      const path = densify(simulationPath(ch.data?.route, ch.data?.segments, START_SPOTS[0].pos), 10);
      const last = session.points[session.points.length - 1];
      sim.current = { path, i: session.points.length ? Math.min(path.length - 1, session.points.length) : 0, t: last ? last.t + 4000 : session.startedAt };
    }
    const id = setInterval(() => {
      const s = useRun.getState().session;
      const m = sim.current!;
      if (!s || s.paused || m.i >= m.path.length) return;
      const p = m.path[m.i++];
      useRun.getState().addPoint({ lat: p[0] + (Math.random() - 0.5) * 0.00003, lng: p[1] + (Math.random() - 0.5) * 0.00003, t: m.t, accuracy: 6 });
      m.t += 4000;
    }, 120);
    return () => clearInterval(id);
  }, [session?.simulated, challengeId, ch.data]);

  // 2초마다 서버로 올리기 + 화면 시계
  useEffect(() => {
    const a = setInterval(() => uploadPending().catch(() => {}), 2000);
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(a);
      clearInterval(t);
    };
  }, []);

  const pts = session?.points ?? [];
  const dist = useMemo(() => distanceOf(pts), [pts]);
  if (!session || (challengeId && !ch.data)) return <Loading />;
  const paused = session.paused;
  const elapsed = session.simulated
    ? pts.length > 1
      ? (pts[pts.length - 1].t - pts[0].t) / 1000
      : 0
    : (now - session.startedAt - session.pausedMs - (paused && session.pausedAt ? now - session.pausedAt : 0)) / 1000;
  const remaining = ch.data ? Math.max(0, ch.data.remainingKm - dist / 1000) : null;
  const trail: LatLng[] = pts.map((p) => [p.lat, p.lng]);
  const here = trail.length ? trail[trail.length - 1] : null;
  const legInfo = legProgress(ch.data, trail, here);
  const pending = pts.length - session.uploaded - 1;

  const togglePause = () => {
    const s = useRun.getState().session!;
    if (s.paused) useRun.getState().patch({ paused: false, pausedMs: s.pausedMs + (s.pausedAt ? Date.now() - s.pausedAt : 0), pausedAt: null });
    else useRun.getState().patch({ paused: true, pausedAt: Date.now() });
    setArm(false);
  };
  const end = async () => {
    setSaving(true);
    setErr(null);
    try {
      if (!useRun.getState().session?.points.length) {
        useRun.getState().clear();
        navigation.goBack();
        return;
      }
      const id = await finishRun();
      navigation.replace('RunSaved', { runId: id });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.map.land }}>
      <Measure height={560}>
        {(w) => (
          <RouteArt
            route={ch.data?.route ?? (trail.length > 1 ? trail : [START_SPOTS[0].pos, START_SPOTS[0].pos])}
            segments={ch.data?.segments}
            w={w}
            h={560}
            pad={48}
            mode={ch.data ? 'faded' : 'route'}
            stroke={5}
            seed={4}
            trail={trail.length > 1 ? { points: trail, color: myColor } : null}
            leg={legInfo ? { points: legInfo.points, color: legInfo.color } : null}
            me={trail.length ? { pos: trail[trail.length - 1], color: myColor } : null}
            map
          />
        )}
      </Measure>
      <Glass style={{ position: 'absolute', left: 16, top: top + 4, height: 44, paddingLeft: 12, paddingRight: 16, borderRadius: 22, backgroundColor: 'rgba(255, 255, 255, 0.92)', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: paused ? C.sub3 : C.limeEdge, boxShadow: `0 0 0 4px ${paused ? 'rgba(174, 174, 178, 0.25)' : 'rgba(132, 204, 22, 0.25)'}` }} />
        <T size={15} weight="600">
          {paused ? '잠시 쉬는 중' : '달리는 중'}
        </T>
        {!paused ? (
          <T size={13} weight="500" color={C.sub}>
            {session.simulated ? 'GPS 시뮬레이션' : 'GPS 좋음'}
          </T>
        ) : null}
      </Glass>
      <RoundBtn kind="custom" label="내 위치로 이동" style={{ position: 'absolute', right: 16, top: top + 4 }}>
        <IcLocate />
      </RoundBtn>
      {legInfo ? (
        <Glass style={{ position: 'absolute', left: 16, right: 16, top: 440, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: legInfo.color }} />
            <T size={14} weight="700" style={{ flex: 1 }}>
              내 구간 · {legInfo.part}
            </T>
            <T size={13} weight="600" color={C.sub} rounded>
              {legInfo.toStartM != null
                ? `시작점까지 ${fmtKm(legInfo.toStartM / 1000, unit)}`
                : legInfo.done >= 1
                  ? '다 채웠어요'
                  : `${pct(legInfo.done)} · ${fmtKm(legInfo.leftKm, unit)} 남음`}
            </T>
          </View>
          <View style={{ height: 6, borderRadius: 3, backgroundColor: C.fill, overflow: 'hidden' }}>
            <View style={{ width: `${Math.round(legInfo.done * 100)}%`, height: 6, backgroundColor: legInfo.color }} />
          </View>
        </Glass>
      ) : ch.data?.remainingPart ? (
        <Glass style={{ position: 'absolute', left: 16, top: 470, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 }}>
          <T size={13} weight="500">
            {ch.data.remainingPart} 구간을 채우는 중
          </T>
        </Glass>
      ) : null}
      <Glass kind="sheet" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '88%', borderRadius: 0, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 24, paddingHorizontal: 24, paddingBottom: b, gap: 18 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <View style={{ gap: 2 }}>
            <T size={12} color={C.sub}>
              시간
            </T>
            <T size={46} weight="700" rounded ls={-0.02} style={{ lineHeight: 50 }}>
              {clock(Math.max(0, elapsed))}
            </T>
          </View>
          <T size={13} color={C.sub} lh={1.4} style={{ textAlign: 'right' }}>
            {'기기에 저장됨\n'}
            {pending > 0 ? `올릴 기록 ${pending}개` : '방금'}
          </T>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Stat label="거리" value={kmParts(dist / 1000, unit, 2)[0]} unit={kmParts(dist / 1000, unit, 2)[1]} />
          <Stat label="페이스" value={pace(dist > 20 ? elapsed / (dist / 1000) : null)} />
          {remaining != null ? <Stat label="남은 구간" value={kmParts(remaining, unit, 1)[0]} unit={kmParts(remaining, unit, 1)[1]} /> : <Stat label="기록 점" value={String(pts.length)} />}
        </View>
        <View style={{ marginTop: 'auto', gap: 10 }}>
          {err ? (
            <T size={13} color={C.danger}>
              {err}
            </T>
          ) : null}
          {paused ? (
            <>
              <T size={13} color={C.sub} lh={1.5}>
                일시정지 중에는 위치를 기록하지 않아요. 다시 달리면 이어서 그려요.
              </T>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Btn title="다시 달리기" icon={<IcPlay />} height={64} flex onPress={togglePause} />
                <Tap onPress={end} style={{ flex: 1 }}>
                  <Glass style={{ height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' }}>
                    <T size={16} weight="600">
                      {saving ? '저장하는 중…' : '여기서 종료'}
                    </T>
                  </Glass>
                </Tap>
              </View>
            </>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Tap label="일시정지" onPress={togglePause}>
                <Glass style={{ width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' }}>
                  <IcPause />
                </Glass>
              </Tap>
              {/* 실수로 끝나지 않게 두 번 눌러 종료 */}
              {arm ? <Btn title={saving ? '저장하는 중…' : '한 번 더 누르면 종료'} kind="dark" height={64} flex onPress={end} /> : <Btn title="종료" height={64} flex onPress={() => setArm(true)} />}
            </View>
          )}
        </View>
      </Glass>
    </View>
  );
}

// ---------- 16 기록 복구 · GPS 공백 ----------

export function Recovery({ navigation }: P<'Recovery'>) {
  const unit = useUnit();
  const session = useRun((s) => s.session);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    uploadPending().catch(() => {});
  }, []);
  if (!session) {
    return (
      <Screen footer={<Btn title="크루 홈으로" onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Tabs' }] })} />}>
        <H1 size={26}>복구할 러닝이 없어요</H1>
      </Screen>
    );
  }
  const pts = session.points;
  const last = pts[pts.length - 1];
  const lastAt = last ? last.t : session.startedAt;
  const gapMin = Math.max(0, Math.round((Date.now() - session.lastSavedAt) / 60000));
  const trail: LatLng[] = pts.map((p) => [p.lat, p.lng]);
  const pending = pts.length - session.uploaded - 1;
  return (
    <Screen
      top={72}
      gap={20}
      footer={
        <>
          <Btn title="지금 위치에서 이어 달리기" onPress={() => navigation.replace('Running', { challengeId: session.challengeId })} />
          <Btn
            title="여기까지 저장하고 끝내기"
            kind="secondary"
            loading={busy}
            onPress={async () => {
              setBusy(true);
              setErr(null);
              try {
                if (!pts.length) {
                  useRun.getState().clear();
                  navigation.reset({ index: 0, routes: [{ name: 'Tabs' }] });
                  return;
                }
                const id = await finishRun();
                navigation.reset({ index: 1, routes: [{ name: 'Tabs' }, { name: 'RunSaved', params: { runId: id } }] });
              } catch (e) {
                setErr((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          />
        </>
      }
    >
      <View style={{ gap: 8 }}>
        <H1 size={26}>지난 러닝을 복구했어요</H1>
        <Sub size={14}>앱이 {hm(session.lastSavedAt)}에 종료됐어요. 마지막으로 저장된 지점까지 기록을 되살렸어요.</Sub>
      </View>
      <View style={{ height: 210, borderRadius: 20, overflow: 'hidden' }}>
        <Measure height={210}>{(w) => (trail.length > 1 ? <RouteArt route={trail} w={w} h={210} pad={30} mode="progress" segments={trail.slice(1).map(() => '#7A5AF8')} stroke={4.5} /> : <View />)}</Measure>
        {gapMin > 0 ? (
          <View style={{ position: 'absolute', left: 14, bottom: 14, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: C.lime }}>
            <T size={11} weight="600">
              기록 없음 · {gapMin}분
            </T>
          </View>
        ) : null}
      </View>
      <Glass style={{ borderRadius: 20 }}>
        <View style={{ minHeight: 48, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <T size={13} weight="600" rounded style={{ width: 60 }}>
            {hm(session.startedAt).replace(/오전 |오후 /, '')}
          </T>
          <T size={14}>기록 시작</T>
        </View>
        <View style={{ minHeight: 48, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <T size={13} weight="600" rounded style={{ width: 60 }}>
            {hm(lastAt).replace(/오전 |오후 /, '')}
          </T>
          <T size={14}>
            마지막 저장 ·{' '}
            <T size={14} rounded>
              {fmtKm(distanceOf(pts) / 1000, unit, 2)}
            </T>
          </T>
        </View>
        <View style={{ minHeight: 60, paddingVertical: 10, paddingHorizontal: 16, flexDirection: 'row', gap: 12 }}>
          <T size={13} weight="600" rounded style={{ width: 60, paddingTop: 1 }}>
            {hm(Date.now()).replace(/오전 |오후 /, '')}
          </T>
          <View style={{ flex: 1, gap: 2 }}>
            <T size={14}>다시 열림</T>
            <T size={12} color={C.sub} lh={1.5}>
              그 사이 구간은 받지 못했어요. 임의로 채우지 않고 빈 칸으로 남겨요.
            </T>
          </View>
        </View>
      </Glass>
      <T size={13} color={C.sub}>
        {pending > 0 ? `업로드 대기 ${pending}개 · 연결되면 자동으로 올라가요` : '기록은 모두 서버에 올라갔어요'}
      </T>
      {err ? (
        <T size={13} color={C.danger}>
          {err}
        </T>
      ) : null}
    </Screen>
  );
}

// ---------- 17 저장 · 달력과 진행률 반영 ----------

export function RunSaved({ navigation, route }: P<'RunSaved'>) {
  const unit = useUnit();
  const qc = useQueryClient();
  const run = useRunQuery(route.params.runId);
  useEffect(() => {
    qc.invalidateQueries({ queryKey: ['challenge'] });
    // 친구와 달리기 카드(홈 맨 위)도 완성 여부를 다시 받아 온다
    qc.invalidateQueries({ queryKey: ['friend'] });
    qc.invalidateQueries({ queryKey: ['runs'] });
    qc.invalidateQueries({ queryKey: ['artworks'] });
    qc.invalidateQueries({ queryKey: ['crews'] });
  }, [qc]);
  if (!run.data) return <Loading />;
  const r = run.data;
  const c = r.challenge;
  const before = c?.progressBefore ?? 0;
  const after = c?.progressAfter ?? before;
  const done = c?.status === 'completed';
  const home = () => navigation.reset({ index: 0, routes: [{ name: 'Tabs' }] });
  const msg = !c
    ? '개인 러닝은 내 달력에만 남고, 크루 작품과 랭킹에는 들어가지 않아요.'
    : c.needsCategory
      ? '마지막 구간이 채워져 직접 그린 그림이 완성됐어요. 이름을 붙이면 크루 랭킹의 카테고리로 올라가요.'
      : done
        ? `마지막 구간이 채워져 ${c.shapeLabel}${['고래', '하트', '토끼'].includes(c.shapeLabel) ? '가' : '이'} 완성됐어요. 크루의 완성도와 협력 결과를 정리했어요.`
        : after - before <= 0
          ? '이번 러닝은 그림 경로와 겹치지 않아 진행률에는 반영되지 않았어요. 달력에는 남아요.'
          : `${fmtKm(c.remainingKm, unit)}가 남았어요. 크루원 누구나 이어서 달릴 수 있어요.`;
  return (
    <Screen
      top={80}
      gap={22}
      footer={
        <>
          {c?.needsCategory ? (
            <Btn title="그림 이름 정하기" onPress={() => navigation.replace('CustomCategory', { challengeId: c.id })} />
          ) : done && c ? (
            <Btn title="완성 작품 보러 가기" onPress={() => (c.isFriend ? navigation.replace('FriendToCrew', { challengeId: c.id }) : navigation.replace('Artwork', { challengeId: c.id }))} />
          ) : (
            <Btn title="크루 홈으로" onPress={home} />
          )}
          <Btn title="이번 기록 자세히" kind="secondary" onPress={() => navigation.navigate('RunDetail', { runId: r.id })} />
        </>
      }
    >
      <View style={{ gap: 8 }}>
        <H1 size={26}>러닝을 저장했어요</H1>
        <T size={14} color={C.sub}>
          {md(r.startedAt)} {hm(r.startedAt)} ·{' '}
          <T size={14} color={C.sub} rounded>
            {clock(r.durationS)}
          </T>{' '}
          ·{' '}
          <T size={14} color={C.sub} rounded>
            {fmtKm(r.distanceKm, unit, 2)}
          </T>
        </T>
      </View>
      {c ? (
        <Glass style={{ borderRadius: 20, padding: 18, gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <T size={14} weight="600">
              {c.isFriend ? '함께 그린 정도' : '크루 누적 진행률'}
            </T>
            <T size={15} weight="600" color={C.sub} rounded>
              {pct(before)} →{' '}
              <T size={24} weight="700" rounded>
                {pct(after)}
              </T>
            </T>
          </View>
          <ProgressBar
            height={12}
            parts={[
              { color: C.lime, value: before },
              { color: '#7A5AF8', value: Math.max(0, after - before) },
            ]}
          />
          <View style={{ flexDirection: 'row', gap: 14 }}>
            {[
              [C.lime, '크루가 그린 곳'],
              ['#7A5AF8', '이번 러닝'],
            ].map(([col, l]) => (
              <View key={l} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: col }} />
                <T size={12} color={C.sub}>
                  {l}
                </T>
              </View>
            ))}
          </View>
          <T size={14} lh={1.5}>
            {msg}
          </T>
        </Glass>
      ) : (
        <Glass style={{ borderRadius: 20, padding: 18 }}>
          <T size={14} lh={1.5}>
            {msg}
          </T>
        </Glass>
      )}
      <Glass style={{ borderRadius: 20, paddingVertical: 4, paddingHorizontal: 16 }}>
        <Tap noScale onPress={() => navigation.navigate('Tabs', { screen: 'Calendar' } as never)} style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <T size={14} style={{ flex: 1 }}>
            내 달력 {md(r.startedAt)}에 추가했어요
          </T>
          <IcChevron size={16} color={C.sub} w={2} />
        </Tap>
        {c ? (
          <Tap noScale onPress={() => navigation.navigate('ChallengeJoin', { challengeId: c.id })} style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <T size={14} style={{ flex: 1 }}>
              {c.title}
              {c.segmentLabel ? ` ${c.segmentLabel} 구간에 반영했어요` : '에 기록했어요'}
            </T>
            <IcChevron size={16} color={C.sub} w={2} />
          </Tap>
        ) : null}
      </Glass>
      {r.gapCount > 0 ? (
        <T size={13} color={C.sub} lh={1.5}>
          GPS가 30초 넘게 끊긴 곳 {r.gapCount}군데는 채우지 않고 빈 칸으로 남겼어요.
        </T>
      ) : null}
    </Screen>
  );
}

// ---------- 17-1 직접 그린 코스 · 카테고리 입력 ----------

export function CustomCategory({ navigation, route }: P<'CustomCategory'>) {
  const ch = useChallenge(route.params.challengeId);
  const cats = useQuery({ queryKey: ['categories'], queryFn: () => api<{ category: string; teams: number }[]>('/categories') });
  const [name, setName] = useState('');
  const save = useAction(
    () => api(`/challenges/${route.params.challengeId}/category`, { method: 'PATCH', body: { name } }),
    [['challenge'], ['artworks'], ['categories']],
  );
  if (!ch.data) return <Loading />;
  const n = name.trim();
  const match = cats.data?.find((c) => c.category === n);
  return (
    <Screen
      gap={16}
      footer={
        <>
          <Btn title="저장하고 작품 보기" disabled={!n} loading={save.isPending} onPress={() => save.mutate(undefined, { onSuccess: () => navigation.replace('Artwork', { challengeId: route.params.challengeId }) })} />
          <Btn title="나중에 정하기" kind="secondary" onPress={() => navigation.replace('Artwork', { challengeId: route.params.challengeId })} />
        </>
      }
    >
      <NavBar onBack={() => navigation.goBack()} />
      <View style={{ gap: 6 }}>
        <H1 size={26}>완성한 그림에 이름을 붙여요</H1>
        <Sub>크루 랭킹에서 같은 이름의 그림끼리 묶여요.</Sub>
      </View>
      <Glass style={{ borderRadius: 20, padding: 10 }}>
        <View style={{ height: 200, borderRadius: 14, overflow: 'hidden' }}>
          <Measure height={200}>{(w) => <RouteArt route={ch.data.route} segments={ch.data.segments} w={w} h={200} pad={20} stroke={8} />}</Measure>
        </View>
      </Glass>
      <Field
        label="카테고리 이름"
        right={
          <T size={13} color={C.sub} rounded>
            {name.length}/12
          </T>
        }
        value={name}
        onChangeText={(t) => setName(t.slice(0, 12))}
        style={{ fontSize: 17 }}
      />
      <T size={13} color={C.sub} lh={1.45}>
        {!n ? '그림을 보고 떠오르는 이름을 적어주세요.' : match ? `'${n}' 랭킹에 함께 올라가요.` : `'${n}' 카테고리가 새로 만들어져요.`}
      </T>
      {cats.data?.length ? (
        <View style={{ gap: 8 }}>
          <T size={13} weight="600" color={C.sub}>
            이미 있는 카테고리
          </T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {cats.data.map((c) => (
              <Chip key={c.category} on={c.category === n} onPress={() => setName(c.category)}>
                <T size={14} weight="600">
                  {c.category}
                  <T size={14} color={C.sub}>
                    {' '}
                    {c.teams}팀
                  </T>
                </T>
              </Chip>
            ))}
          </View>
        </View>
      ) : null}
      <ErrorText error={save.error} />
    </Screen>
  );
}
