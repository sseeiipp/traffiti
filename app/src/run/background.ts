import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import { useRun } from '../store/run';

/**
 * 화면이 꺼지거나 다른 앱으로 가도 러닝 위치를 계속 받는 백그라운드 작업.
 * 작업 정의는 앱이 뜰 때(index.ts) 한 번 불러와야 운영체제가 앱을 깨웠을 때도 찾는다.
 * Expo Go에서는 막혀 있는 경우가 많아(특히 iOS) 시작에 실패하면 앞 화면 위치(watchPosition)로 돌아간다.
 */
export const BG_TASK = 'travity-run-location';

if (Platform.OS !== 'web') {
  try {
    TaskManager.defineTask<{ locations: Location.LocationObject[] }>(BG_TASK, async ({ data, error }) => {
      if (error || !data?.locations?.length) return;
      for (const l of data.locations)
        useRun.getState().addPoint({ lat: l.coords.latitude, lng: l.coords.longitude, t: l.timestamp, accuracy: l.coords.accuracy ?? null });
    });
  } catch {
    // 작업 관리자가 없는 환경(Expo Go 일부)
  }
}

/** 백그라운드 위치 권한 상태. 'undetermined'면 아직 한 번도 묻지 않은 것 */
export async function backgroundStatus(): Promise<'granted' | 'denied' | 'undetermined' | 'unsupported'> {
  if (Platform.OS === 'web') return 'unsupported';
  try {
    const p = await Location.getBackgroundPermissionsAsync();
    return p.granted ? 'granted' : p.canAskAgain && p.status === 'undetermined' ? 'undetermined' : 'denied';
  } catch {
    return 'unsupported';
  }
}

export async function askBackground(): Promise<boolean> {
  try {
    return (await Location.requestBackgroundPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

/** 백그라운드 위치 받기 시작. 안 되면 false(앞 화면 위치로 받는다) */
export async function startBackground(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    if (!(await Location.getBackgroundPermissionsAsync()).granted) return false;
    if (await Location.hasStartedLocationUpdatesAsync(BG_TASK)) return true;
    await Location.startLocationUpdatesAsync(BG_TASK, {
      accuracy: Location.Accuracy.BestForNavigation,
      distanceInterval: 5,
      timeInterval: 2000,
      activityType: Location.ActivityType.Fitness,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: '트래비티 러닝 기록 중',
        notificationBody: '화면이 꺼져도 달린 길을 계속 그려요.',
        notificationColor: '#A3E635',
      },
    });
    return true;
  } catch {
    return false;
  }
}

export async function stopBackground() {
  if (Platform.OS === 'web') return;
  try {
    if (await Location.hasStartedLocationUpdatesAsync(BG_TASK)) await Location.stopLocationUpdatesAsync(BG_TASK);
  } catch {
    // 이미 멈췄거나 지원하지 않는 환경
  }
}

// 러닝이 끝나거나 버려지면(기기 기록이 지워지면) 백그라운드 위치도 멈춘다
if (Platform.OS !== 'web') useRun.subscribe((s, prev) => {
  if (prev.session && !s.session) stopBackground();
});
