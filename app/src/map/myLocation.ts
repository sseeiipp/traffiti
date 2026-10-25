import * as Location from 'expo-location';
import type { LatLng } from './MapArt';

const within = <T,>(p: Promise<T>, ms: number) =>
  Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), ms))]);

/**
 * 지금 위치. 아직 권한을 묻지 않았으면 ask일 때 허용 창을 띄운다.
 * 권한이 없거나 위치를 못 받으면 null (호출한 쪽이 기본 위치를 쓴다)
 */
export async function myLocation(ask = true): Promise<LatLng | null> {
  try {
    let p = await Location.getForegroundPermissionsAsync();
    if (!p.granted && ask && p.canAskAgain) p = await Location.requestForegroundPermissionsAsync();
    if (!p.granted) return null;
    // GPS가 늦게 잡히면 마지막으로 알던 위치라도 쓴다
    const l =
      (await within(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), 8000)) ??
      (await Location.getLastKnownPositionAsync());
    return l ? [l.coords.latitude, l.coords.longitude] : null;
  } catch {
    return null;
  }
}
