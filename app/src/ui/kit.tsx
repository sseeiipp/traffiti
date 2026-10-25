import { useQueryClient } from '@tanstack/react-query';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Children, createContext, ReactNode, useContext, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  useWindowDimensions,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { C, font, PRESS, shadow } from '../theme';
import { IcBack, IcCheck, IcChevron, IcClose } from './icons';

// ---------- 글자 ----------

type TProps = {
  children?: ReactNode;
  size?: number;
  weight?: '400' | '500' | '600' | '700' | '800';
  color?: string;
  rounded?: boolean;
  lh?: number;
  center?: boolean;
  ls?: number;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
};

const ANDROID_FONT: Record<NonNullable<TProps['weight']>, string> | null =
  Platform.OS === 'android'
    ? { '400': 'NotoSansKR_400Regular', '500': 'NotoSansKR_500Medium', '600': 'NotoSansKR_600SemiBold', '700': 'NotoSansKR_700Bold', '800': 'NotoSansKR_700Bold' }
    : null;

export function T({ children, size = 15, weight = '400', color = C.ink, rounded, lh, center, ls, style, numberOfLines }: TProps) {
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        {
          fontSize: size,
          // 안드로이드는 시스템 한글 글꼴 대신 Noto Sans KR을 굵기별 파일로 쓴다
          fontWeight: ANDROID_FONT ? undefined : weight,
          color,
          fontFamily: ANDROID_FONT ? ANDROID_FONT[weight] : rounded ? font.rounded : font.text,
          lineHeight: lh ? Math.round(size * lh) : undefined,
          textAlign: center ? 'center' : undefined,
          letterSpacing: ls != null ? ls * size : undefined,
          // 안드로이드는 글꼴 위아래 여백을 더해 글자가 디자인보다 커 보이고 줄이 어긋난다
          includeFontPadding: false,
        },
        rounded && { fontVariant: ['tabular-nums'] },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export const H1 = ({ children, size = 32, style }: { children: ReactNode; size?: number; style?: StyleProp<TextStyle> }) => (
  <T size={size} weight="700" lh={size >= 30 ? 1.15 : 1.25} ls={size >= 30 ? -0.025 : -0.02} style={style}>
    {children}
  </T>
);

export const Sub = ({ children, size = 15, style }: { children: ReactNode; size?: number; style?: StyleProp<TextStyle> }) => (
  <T size={size} color={C.sub} lh={1.5} style={style}>
    {children}
  </T>
);

// ---------- 누르기 ----------

/** 누르면 살짝 작아졌다 스프링처럼 돌아오는 영역 */
export function Tap({
  onPress,
  disabled,
  style,
  children,
  label,
  noScale,
}: {
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  label?: string;
  noScale?: boolean;
}) {
  const s = useRef(new Animated.Value(1)).current;
  const to = (v: number, ms: number) => Animated.timing(s, { toValue: v, duration: ms, useNativeDriver: Platform.OS !== 'web' }).start();
  // 바깥 배치(flex·폭·위치)는 누르는 영역에 줘야 자리를 제대로 차지한다
  const flat = (StyleSheet.flatten(style) ?? {}) as ViewStyle;
  const { flex, flexGrow, width, maxWidth, alignSelf, position, left, right, top, bottom, margin, marginTop, marginLeft, ...inner } = flat;
  const outer = { flex, flexGrow, width, maxWidth, alignSelf, position, left, right, top, bottom, margin, marginTop, marginLeft };
  const hasOuter = Object.values(outer).some((v) => v !== undefined);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={hasOuter ? outer : undefined}
      onPressIn={() => !noScale && to(PRESS.scale, PRESS.inMs)}
      onPressOut={() => !noScale && Animated.spring(s, { toValue: 1, useNativeDriver: Platform.OS !== 'web', speed: 14, bounciness: 8 }).start()}
    >
      <Animated.View style={[hasOuter ? inner : style, { transform: [{ scale: s }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

// ---------- 유리 ----------

/** 리퀴드 글래스: 흰 88% + 흐림. sheet는 흰 94% + 더 강한 흐림 */
export function Glass({
  children,
  style,
  kind = 'white',
  intensity,
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  kind?: 'white' | 'sheet' | 'lime';
  intensity?: number;
}) {
  const nested = useContext(InGlass);
  const flat = StyleSheet.flatten(style) ?? {};
  const radius = flat.borderRadius ?? 20;
  const bg = kind === 'lime' ? C.limeGlass : kind === 'sheet' ? 'rgba(255, 255, 255, 0.94)' : 'rgba(255, 255, 255, 0.88)';
  return (
    <View
      style={[
        { borderRadius: radius, boxShadow: kind === 'lime' ? shadow.lime : kind === 'sheet' ? shadow.glassSheet : shadow.glass },
        style,
        // zIndex 0으로 쌓임 맥락을 만들어 흐림 층(zIndex -1)이 배경 위·내용 아래에 그려지게 한다
        { backgroundColor: flat.backgroundColor ?? bg, overflow: 'hidden', zIndex: flat.zIndex ?? 0 },
      ]}
    >
      {/* 연두 유리는 90% 불투명이라 흐림을 겹치면 오히려 얼룩이 생긴다 */}
      {/* 유리 안의 유리는 웹에서 backdrop-filter가 겹쳐 번지므로 바깥 하나만 흐린다 */}
      {kind === 'lime' || nested ? null : (
        <BlurView intensity={intensity ?? (kind === 'sheet' ? 40 : 22)} tint="light" style={[StyleSheet.absoluteFill, { borderRadius: radius, zIndex: -1 }]} pointerEvents="none" />
      )}
      <InGlass.Provider value={true}>{children}</InGlass.Provider>
    </View>
  );
}

const InGlass = createContext(false);

// ---------- 버튼 ----------

type BtnKind = 'primary' | 'secondary' | 'fill' | 'danger' | 'dangerSoft' | 'dark' | 'ghost';

export function Btn({
  title,
  onPress,
  kind = 'primary',
  disabled,
  loading,
  icon,
  height = 52,
  style,
  flex,
  textSize = 16,
}: {
  title: string;
  onPress?: () => void;
  kind?: BtnKind;
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  height?: number;
  style?: StyleProp<ViewStyle>;
  flex?: boolean;
  textSize?: number;
}) {
  const off = disabled || loading;
  const bg: Record<BtnKind, string> = {
    primary: C.limeGlass,
    secondary: '#FFFFFF',
    fill: C.fill,
    danger: C.danger,
    dangerSoft: 'rgba(217, 45, 32, 0.1)',
    dark: C.ink,
    ghost: 'transparent',
  };
  const fg: Record<BtnKind, string> = {
    primary: C.ink,
    secondary: C.ink,
    fill: C.ink,
    danger: '#FFFFFF',
    dangerSoft: C.danger,
    dark: '#FFFFFF',
    ghost: C.limeText,
  };
  return (
    <Tap
      onPress={onPress}
      disabled={off}
      label={title}
      style={[
        {
          height,
          borderRadius: 999,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 8,
          paddingHorizontal: 16,
          backgroundColor: disabled ? C.seg : bg[kind],
          boxShadow: disabled ? undefined : kind === 'secondary' ? shadow.soft : kind === 'primary' ? shadow.lime : undefined,
        },
        flex && { flex: 1 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg[kind]} /> : icon}
      <T size={textSize} weight={kind === 'ghost' ? '500' : '600'} color={disabled ? C.sub2 : fg[kind]}>
        {title}
      </T>
    </Tap>
  );
}

/** 44px 원형 유리 버튼(뒤로·닫기) */
export function RoundBtn({
  onPress,
  kind = 'back',
  label,
  size = 44,
  children,
  style,
}: {
  onPress?: () => void;
  kind?: 'back' | 'close' | 'custom';
  label?: string;
  size?: number;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Tap onPress={onPress} label={label ?? (kind === 'close' ? '닫기' : '뒤로')} style={style}>
      <Glass style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }}>
        {kind === 'back' ? <IcBack /> : kind === 'close' ? <IcClose /> : children}
      </Glass>
    </Tap>
  );
}

export function TextLink({
  title,
  onPress,
  color = C.limeText,
  size = 14,
  weight = '500',
  style,
}: {
  title: string;
  onPress?: () => void;
  color?: string;
  size?: number;
  weight?: TProps['weight'];
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Tap onPress={onPress} noScale style={[{ minHeight: 44, justifyContent: 'center' }, style]}>
      <T size={size} weight={weight} color={color}>
        {title}
      </T>
    </Tap>
  );
}

// ---------- 선택 ----------

export function Chip({ label, on, onPress, style, children }: { label?: string; on?: boolean; onPress?: () => void; style?: StyleProp<ViewStyle>; children?: ReactNode }) {
  return (
    <Tap
      onPress={onPress}
      style={[
        {
          height: 36,
          paddingHorizontal: 14,
          borderRadius: 999,
          justifyContent: 'center',
          alignItems: 'center',
          flexDirection: 'row',
          gap: 2,
          backgroundColor: on ? C.lime : '#FFFFFF',
          boxShadow: on ? shadow.chipOn : shadow.soft,
        },
        style,
      ]}
    >
      {children ?? (
        <T size={14} weight={on ? '600' : '500'}>
          {label}
        </T>
      )}
    </Tap>
  );
}

/** 회색 판 위에 흰 칸이 선택을 표시하는 탭. small은 32px */
export function Segmented<K extends string>({
  items,
  value,
  onChange,
  small,
  style,
}: {
  items: { key: K; label: string }[];
  value: K;
  onChange: (k: K) => void;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ flexDirection: 'row', gap: small ? 2 : 4, padding: small ? 2 : 4, backgroundColor: C.seg, borderRadius: small ? 10 : 14 }, style]}>
      {items.map((it) => {
        const on = it.key === value;
        return (
          <Pressable
            key={it.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(it.key)}
            style={{
              flex: 1,
              height: small ? 32 : 40,
              borderRadius: small ? 8 : 11,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: on ? '#FFFFFF' : 'transparent',
              boxShadow: on ? '0 1px 3px rgba(17, 24, 39, 0.14), 0 0 0 0.5px rgba(17, 24, 39, 0.06)' : undefined,
            }}
          >
            <T size={small ? 13 : 14} weight={on ? '600' : '500'} color={on || small ? C.ink : C.sub}>
              {it.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  const x = useRef(new Animated.Value(on ? 1 : 0)).current;
  const [last, setLast] = useState(on);
  if (last !== on) {
    setLast(on);
    Animated.timing(x, { toValue: on ? 1 : 0, duration: 200, useNativeDriver: false }).start();
  }
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      accessibilityLabel={label}
      onPress={() => onChange(!on)}
      style={{ width: 51, height: 31, borderRadius: 16, padding: 2, backgroundColor: on ? C.toggle : '#E9E9EB' }}
    >
      <Animated.View
        style={{
          width: 27,
          height: 27,
          borderRadius: 14,
          backgroundColor: '#FFFFFF',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.15)',
          transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [0, 20] }) }],
        }}
      />
    </Pressable>
  );
}

export function CheckCircle({ on, danger, size = 26 }: { on: boolean; danger?: boolean; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: on ? (danger ? C.danger : C.toggle) : '#FFFFFF',
        boxShadow: on ? undefined : 'inset 0 0 0 1.5px #C7C7CC',
      }}
    >
      <IcCheck size={16} color={on ? '#FFFFFF' : '#C7C7CC'} w={3.2} />
    </View>
  );
}

// ---------- 목록 ----------

export function Group({ title, children, style, pad = 16, first }: { title?: string; children: ReactNode; style?: StyleProp<ViewStyle>; pad?: number; first?: boolean }) {
  return (
    <>
      {title ? (
        <T size={13} weight="600" color={C.sub} style={{ marginTop: first ? 0 : 12, marginLeft: 4 }}>
          {title}
        </T>
      ) : null}
      <Glass style={[{ borderRadius: 20, paddingHorizontal: pad, paddingVertical: 4 }, style]}>{children}</Glass>
    </>
  );
}

export function Row({
  label,
  hint,
  value,
  onPress,
  chevron = !!onPress,
  right,
  minHeight = 52,
  color = C.ink,
  center,
}: {
  label: ReactNode;
  hint?: string;
  value?: ReactNode;
  onPress?: () => void;
  chevron?: boolean;
  right?: ReactNode;
  minHeight?: number;
  color?: string;
  center?: boolean;
}) {
  const body = (
    <View style={{ minHeight, flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: center ? 'center' : undefined }}>
      <View style={{ flex: center ? undefined : 1, gap: 2 }}>
        {typeof label === 'string' ? (
          <T size={16} color={color} weight={center ? '500' : '400'}>
            {label}
          </T>
        ) : (
          label
        )}
        {hint ? (
          <T size={13} color={C.sub}>
            {hint}
          </T>
        ) : null}
      </View>
      {typeof value === 'string' ? (
        <T size={15} color={C.sub}>
          {value}
        </T>
      ) : (
        value
      )}
      {right}
      {chevron ? <IcChevron /> : null}
    </View>
  );
  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="button">
      {body}
    </Pressable>
  ) : (
    body
  );
}

export function RadioRow({
  label,
  hint,
  on,
  onPress,
  disabled,
  minHeight = 56,
}: {
  label: string;
  hint?: string;
  on: boolean;
  onPress?: () => void;
  disabled?: boolean;
  minHeight?: number;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: on, disabled }}
      onPress={disabled ? undefined : onPress}
      style={{ minHeight, flexDirection: 'row', alignItems: 'center', gap: 12, opacity: disabled && !on ? 0.45 : 1 }}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <T size={16}>{label}</T>
        {hint ? (
          <T size={hint.length > 30 ? 12 : 13} color={C.sub}>
            {hint}
          </T>
        ) : null}
      </View>
      {on ? <IcCheck /> : null}
    </Pressable>
  );
}

// ---------- 입력 ----------

export function Field({ label, right, height = 52, style, ...input }: TextInputProps & { label?: string; right?: ReactNode; height?: number }) {
  return (
    <View style={{ gap: 6 }}>
      {label || right ? (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <T size={13} weight="600">
            {label}
          </T>
          {right}
        </View>
      ) : null}
      <TextInput
        placeholderTextColor={C.sub3}
        {...input}
        style={[
          {
            height: input.multiline ? undefined : height,
            minHeight: input.multiline ? 96 : undefined,
            borderRadius: 14,
            backgroundColor: C.field,
            paddingHorizontal: 16,
            paddingVertical: input.multiline ? 14 : 0,
            fontSize: 16,
            color: C.ink,
            fontFamily: font.text,
            textAlignVertical: input.multiline ? 'top' : 'center',
          },
          Platform.OS === 'web' && ({ outlineStyle: 'none' } as any),
          style,
        ]}
      />
    </View>
  );
}

/** 숫자 6칸 코드 입력 */
export function CodeCells({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const ref = useRef<React.ComponentRef<typeof TextInput>>(null);
  return (
    <Pressable onPress={() => ref.current?.focus()} style={{ position: 'relative' }}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const ch = value[i] ?? '';
          const active = i === value.length;
          return (
            <View
              key={i}
              style={{
                flex: 1,
                height: 60,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: ch ? '#FFFFFF' : C.field,
                boxShadow: active ? `0 0 0 2px ${C.limeEdge}` : ch ? '0 1px 3px rgba(0, 0, 0, 0.1), 0 4px 12px rgba(0, 0, 0, 0.06)' : undefined,
              }}
            >
              <T size={26} weight="700" rounded>
                {ch}
              </T>
            </View>
          );
        })}
      </View>
      <TextInput
        ref={ref}
        value={value}
        onChangeText={(t) => onChange(t.replace(/[^0-9]/g, '').slice(0, 6))}
        keyboardType="number-pad"
        maxLength={6}
        accessibilityLabel={label}
        autoComplete="one-time-code"
        caretHidden
        style={[
          StyleSheet.absoluteFill,
          // 안드로이드는 color: transparent만으로는 글자가 비쳐 보여 입력칸 자체를 투명하게 만든다
          { color: 'transparent', backgroundColor: 'transparent', fontSize: 16, opacity: 0 },
          Platform.OS === 'web' && ({ outlineStyle: 'none', caretColor: 'transparent' } as any),
        ]}
      />
    </Pressable>
  );
}

// ---------- 화면 틀 ----------

export function useTop() {
  const ins = useSafeAreaInsets();
  return Math.max(52, ins.top + 8);
}
export function useBottom() {
  const ins = useSafeAreaInsets();
  return Math.max(34, ins.bottom + 12);
}

/** 768px 이상(넓은 화면): 하단 메뉴가 왼쪽 세로 메뉴로, 탭 화면은 2열, 폼·흐름 화면은 가운데 600px */
export const WIDE = 768;
export const FORM_MAX = 600;
export function useWide() {
  return useWindowDimensions().width >= WIDE;
}

/** 탭 화면(홈·크루·달력·갤러리) 틀. 넓은 화면에서는 머리말 아래 내용을 2열로 놓는다 */
export function TabPage({ header, children, gap = 16, single }: { header: ReactNode; children: ReactNode; gap?: number; single?: boolean }) {
  const top = useTop();
  const wide = useWide();
  const items = Children.toArray(children).filter(Boolean);
  const cols = wide && !single ? [items.filter((_, i) => i % 2 === 0), items.filter((_, i) => i % 2 === 1)] : null;
  // 아래로 당기면 이 화면의 데이터를 다시 불러온다
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const refresh = () => {
    setRefreshing(true);
    qc.refetchQueries({ type: 'active' }).finally(() => setRefreshing(false));
  };
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={C.sub} colors={[C.ink]} progressViewOffset={Math.max(58, top + 6)} />}
      >
        <View
          style={
            wide
              ? { paddingTop: Math.max(58, top + 6), paddingLeft: 132, paddingRight: 32, paddingBottom: 48, gap, width: '100%', maxWidth: 1080, alignSelf: 'center' }
              : { paddingTop: Math.max(58, top + 6), paddingHorizontal: 20, paddingBottom: 120, gap }
          }
        >
          {header}
          {cols ? (
            <View style={{ flexDirection: 'row', gap: 28, alignItems: 'flex-start' }}>
              {cols.map((col, i) => (
                <View key={i} style={{ flex: 1, minWidth: 0, gap }}>
                  {col}
                </View>
              ))}
            </View>
          ) : (
            items
          )}
        </View>
      </ScrollView>
    </View>
  );
}

/** 흰 바탕 화면. footer는 아래에 붙는 버튼 영역 */
export function Screen({
  children,
  footer,
  gap = 16,
  pad = 20,
  top,
  scroll = true,
  bottomSpace,
}: {
  children: ReactNode;
  footer?: ReactNode;
  gap?: number;
  pad?: number;
  top?: number;
  scroll?: boolean;
  bottomSpace?: number;
}) {
  const t = useTop();
  const b = useBottom();
  const wide = useWide();
  // 넓은 화면에서는 가운데 600px 폭
  const center = wide ? ({ width: '100%', maxWidth: FORM_MAX, alignSelf: 'center' } as const) : null;
  const inner = <View style={[{ paddingTop: top ?? t, paddingHorizontal: pad, gap, paddingBottom: bottomSpace ?? (footer ? 140 : 40) }, center]}>{children}</View>;
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {scroll ? (
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {inner}
        </ScrollView>
      ) : (
        inner
      )}
      {footer ? (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center' }}>
          {/* 디자인처럼 위 20px은 투명에서 흰색으로 이어져 스크롤된 내용이 버튼 뒤로 비치지 않게 한다 */}
          <LinearGradient colors={['rgba(255, 255, 255, 0)', '#FFFFFF']} locations={[0, 1]} style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 20 }} pointerEvents="none" />
          <View style={{ position: 'absolute', left: 0, right: 0, top: 20, bottom: 0, backgroundColor: '#FFFFFF' }} pointerEvents="none" />
          <View style={[{ width: '100%', paddingTop: 12, paddingHorizontal: pad, paddingBottom: b, gap: 8 }, center]}>{footer}</View>
        </View>
      ) : null}
    </View>
  );
}

export function NavBar({ onBack, kind = 'back', title, right, step }: { onBack?: () => void; kind?: 'back' | 'close'; title?: string; right?: ReactNode; step?: string }) {
  return (
    <View style={{ height: 44, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      {onBack ? <RoundBtn kind={kind} onPress={onBack} /> : null}
      <View style={{ flex: 1 }}>
        {title ? (
          <T size={17} weight="600">
            {title}
          </T>
        ) : null}
      </View>
      {step ? (
        <T size={13} weight="600" color={C.sub} rounded>
          {step}
        </T>
      ) : null}
      {right}
    </View>
  );
}

/** 아래에서 올라오는 유리 시트(모달) */
export function Sheet({ open, onClose, children, inset = 10, radius = 32 }: { open: boolean; onClose: () => void; children: ReactNode; inset?: number; radius?: number }) {
  // 모달이라 하단 메뉴 위로 덮는다. 넓은 화면에서는 가운데 600px
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(21, 23, 28, 0.25)' }]} onPress={onClose} accessibilityLabel="닫기" />
      <View pointerEvents="box-none" style={{ flex: 1, alignItems: 'center' }}>
        <View pointerEvents="box-none" style={{ flex: 1, width: '100%', maxWidth: FORM_MAX + inset * 2 }}>
          <Glass
            kind="sheet"
            style={{
              position: 'absolute',
              left: inset,
              right: inset,
              bottom: inset,
              borderRadius: radius,
              backgroundColor: 'rgba(255, 255, 255, 0.94)',
              paddingTop: 10,
              paddingHorizontal: 18,
              paddingBottom: 22,
              gap: 14,
              boxShadow: shadow.sheet,
            }}
          >
            <Handle />
            {children}
          </Glass>
        </View>
      </View>
    </Modal>
  );
}

/** 시트 위 회색 손잡이는 디자인에서 뺐다. 자리만 남겨 둔다 */
export const Handle = () => null;

// ---------- 표시 ----------

export function Avatar({
  letter,
  color,
  size = 44,
  ink = '#FFFFFF',
  radius,
  style,
  children,
}: {
  letter: string;
  color: string;
  size?: number;
  ink?: string;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}) {
  return (
    <View style={[{ width: size, height: size, borderRadius: radius ?? size / 2, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }, style]}>
      <T size={Math.round(size * 0.38)} weight="600" color={ink}>
        {letter}
      </T>
      {children}
    </View>
  );
}

/** 올린 사진. 주소가 없으면 빈 칸만 보인다 */
export function CrewPhoto({ uri, size = 44, radius = 12 }: { uri?: string | null; size?: number; radius?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: radius, overflow: 'hidden', backgroundColor: C.field }}>
      {uri ? <Image source={{ uri }} style={{ width: size, height: size }} resizeMode="cover" /> : null}
    </View>
  );
}

export function CrewAvatar({ crew, size = 44, radius }: { crew: { name: string; photoUrl?: string | null; color?: string }; size?: number; radius?: number }) {
  const r = radius ?? Math.round(size * 0.28);
  if (crew.photoUrl) return <CrewPhoto uri={crew.photoUrl} size={size} radius={r} />;
  const color = crew.color ?? C.lime;
  return <Avatar letter={crew.name.slice(0, 1)} color={color} ink={color === C.lime ? C.ink : '#FFFFFF'} size={size} radius={r} />;
}

/** 사람별 구간 + 남은 부분 진행 막대 */
export function ProgressBar({ parts, height = 10 }: { parts: { color: string; value: number }[]; height?: number }) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  const list = [...parts.filter((p) => p.value > 0)];
  if (total < 1) list.push({ color: C.seg, value: 1 - total });
  return (
    <View style={{ flexDirection: 'row', gap: 3, height }}>
      {list.map((p, i) => (
        <View
          key={i}
          style={{
            flex: p.value,
            backgroundColor: p.color,
            borderTopLeftRadius: i === 0 ? height / 2 : 0,
            borderBottomLeftRadius: i === 0 ? height / 2 : 0,
            borderTopRightRadius: i === list.length - 1 ? height / 2 : 0,
            borderBottomRightRadius: i === list.length - 1 ? height / 2 : 0,
          }}
        />
      ))}
    </View>
  );
}

export function Pill({
  label,
  bg = C.lime,
  color = C.ink,
  height = 22,
  size = 11,
  style,
}: {
  label: string;
  bg?: string;
  color?: string;
  height?: number;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ alignSelf: 'flex-start', height, paddingHorizontal: 8, borderRadius: height / 2, backgroundColor: bg, justifyContent: 'center' }, style]}>
      <T size={size} weight="600" color={color}>
        {label}
      </T>
    </View>
  );
}

export function Stat({ label, value, unit, size = 22, weight = '600' }: { label: string; value: string; unit?: string; size?: number; weight?: '600' | '700' }) {
  return (
    <View style={{ gap: 2, flex: 1 }}>
      <T size={12} color={C.sub}>
        {label}
      </T>
      <T size={size} weight={weight} rounded>
        {value}
        {unit ? (
          <T size={13} weight="600" rounded>
            {unit}
          </T>
        ) : null}
      </T>
    </View>
  );
}

export function StatCard({ label, value, unit, plain, radius = 14 }: { label: string; value: string; unit?: string; plain?: boolean; radius?: number }) {
  return (
    <Glass style={{ flex: 1, borderRadius: radius, padding: 12, gap: 4 }}>
      <T size={12} color={C.sub}>
        {label}
      </T>
      {plain ? (
        <T size={19} weight="700">
          {value}
        </T>
      ) : (
        <T size={20} weight="700" rounded>
          {value}
          {unit ? (
            <T size={13} weight="600" rounded>
              {unit}
            </T>
          ) : null}
        </T>
      )}
    </Glass>
  );
}

export function Loading() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg }}>
      <ActivityIndicator color={C.toggle} />
    </View>
  );
}

export function ErrorText({ error }: { error?: unknown }) {
  if (!error) return null;
  return (
    <T size={13} color={C.danger} lh={1.4}>
      {(error as Error).message}
    </T>
  );
}

export function Toast({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 60, left: 20, right: 20, alignItems: 'center', zIndex: 50 }}>
      <View style={{ backgroundColor: 'rgba(29, 29, 31, 0.92)', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12 }}>
        <T size={14} weight="500" color="#FFFFFF">
          {text}
        </T>
      </View>
    </View>
  );
}
