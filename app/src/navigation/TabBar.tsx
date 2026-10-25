import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from '../theme';
import { TabCalendar, TabCrew, TabGallery, TabHome } from '../ui/icons';
import { Glass, T, useWide } from '../ui/kit';

const ITEMS = [
  { name: 'Home', label: '홈', Icon: TabHome },
  { name: 'CrewResult', label: '크루', Icon: TabCrew },
  { name: 'Calendar', label: '달력', Icon: TabCalendar },
  { name: 'Gallery', label: '갤러리', Icon: TabGallery },
];

/** 떠 있는 유리 알약. 선택 탭의 연두 표시가 이전 탭에서 새 탭으로 미끄러진다 */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const ins = useSafeAreaInsets();
  const wide = useWide();
  const [w, setW] = useState(0);
  const x = useRef(new Animated.Value(state.index)).current;
  useEffect(() => {
    Animated.timing(x, { toValue: state.index, duration: 500, easing: Easing.bezier(0.22, 1, 0.36, 1), useNativeDriver: false }).start();
  }, [state.index, x]);
  const go = (i: number) => {
    if (state.index !== i) navigation.navigate(ITEMS[i].name as never);
  };
  if (wide) {
    // 넓은 화면: 왼쪽 가운데 세로 메뉴, 선택 탭은 라임 배경
    return (
      <View pointerEvents="box-none" style={{ position: 'absolute', left: 20, top: 0, bottom: 0, justifyContent: 'center' }}>
        <Glass kind="sheet" style={{ width: 84, borderRadius: 28, backgroundColor: 'rgba(255, 255, 255, 0.9)', paddingVertical: 8, paddingHorizontal: 6, gap: 2 }}>
          {ITEMS.map((it, i) => (
            <View
              key={it.name}
              style={{
                height: 60,
                borderRadius: 22,
                backgroundColor: state.index === i ? C.lime : 'transparent',
                boxShadow: state.index === i ? '0 4px 14px rgba(101, 163, 13, 0.3)' : undefined,
              }}
            >
              <TabItem on={state.index === i} label={it.label} Icon={it.Icon} onPress={() => go(i)} tall />
            </View>
          ))}
        </Glass>
      </View>
    );
  }
  const cell = (w - 12) / 4;
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 16, right: 16, bottom: Math.max(24, ins.bottom + 4) }}>
      <Glass kind="sheet" style={{ height: 64, borderRadius: 32, backgroundColor: 'rgba(255, 255, 255, 0.9)', paddingHorizontal: 6, flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1, flexDirection: 'row' }} onLayout={(e) => setW(e.nativeEvent.layout.width + 12)}>
          {w > 0 ? (
            <Animated.View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: 0,
                width: cell,
                height: 52,
                borderRadius: 26,
                backgroundColor: C.lime,
                boxShadow: '0 4px 14px rgba(101, 163, 13, 0.3)',
                left: x.interpolate({ inputRange: [0, 3], outputRange: [0, cell * 3] }),
              }}
            />
          ) : null}
          {ITEMS.map((it, i) => {
            const on = state.index === i;
            return <TabItem key={it.name} on={on} label={it.label} Icon={it.Icon} onPress={() => go(i)} />;
          })}
        </View>
      </Glass>
    </View>
  );
}

function TabItem({ on, label, Icon, onPress, tall }: { on: boolean; label: string; Icon: (p: { color: string }) => React.ReactElement; onPress: () => void; tall?: boolean }) {
  // 누르는 영역은 그대로, 아이콘만 작아진다
  const s = useRef(new Animated.Value(1)).current;
  const color = on ? C.ink : C.sub;
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: on }}
      accessibilityLabel={label}
      onPress={onPress}
      onPressIn={() => Animated.timing(s, { toValue: 0.86, duration: 120, useNativeDriver: false }).start()}
      onPressOut={() => Animated.spring(s, { toValue: 1, useNativeDriver: false, speed: 14, bounciness: 8 }).start()}
      style={{ flex: 1, height: tall ? 60 : 52, alignItems: 'center', justifyContent: 'center' }}
    >
      <Animated.View style={{ alignItems: 'center', gap: 3, transform: [{ scale: s }] }}>
        <Icon color={color} />
        <T size={11} weight={on ? '600' : '500'} color={color}>
          {label}
        </T>
      </Animated.View>
    </Pressable>
  );
}
