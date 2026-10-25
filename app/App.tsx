import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  NotoSansKR_400Regular,
  NotoSansKR_500Medium,
  NotoSansKR_600SemiBold,
  NotoSansKR_700Bold,
  useFonts,
} from '@expo-google-fonts/noto-sans-kr';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Root } from './src/navigation/Root';

const qc = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 15_000 } } });

// 앱으로 돌아오면(백그라운드 → 앞) 보고 있는 화면의 데이터를 다시 불러온다
if (Platform.OS !== 'web')
  focusManager.setEventListener((handle) => {
    const sub = AppState.addEventListener('change', (s) => handle(s === 'active'));
    return () => sub.remove();
  });

// 경로 제안·그림 목록처럼 무겁거나 바뀌지 않는 것은 화면을 옮길 때 다시 부르지 않는다
const KEEP = new Set(['suggest', 'shapes']);
const routeName = (s: any): string | undefined => (s?.routes?.[s.index ?? 0] ? (routeName(s.routes[s.index ?? 0].state) ?? s.routes[s.index ?? 0].name) : undefined);
let lastRoute: string | undefined;
/** 화면(홈·크루·달력·갤러리 등)을 열 때마다 바뀐 내용을 다시 불러온다 */
function onNavChange(state: unknown) {
  const name = routeName(state);
  if (!name || name === lastRoute) return;
  lastRoute = name;
  qc.invalidateQueries({ predicate: (q) => !KEEP.has(String(q.queryKey[0])), refetchType: 'active' });
}

const theme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: '#FFFFFF' } };

/** 웹에서는 Inter·Noto Sans KR을 불러온다(애플 기기는 시스템 글꼴을 쓴다) */
function useWebFonts() {
  useEffect(() => {
    if (Platform.OS !== 'web' || document.getElementById('crew-fonts')) return;
    const l = document.createElement('link');
    l.id = 'crew-fonts';
    l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Noto+Sans+KR:wght@400;500;600;700;800&display=swap';
    document.head.appendChild(l);
    const s = document.createElement('style');
    s.textContent = 'html,body{background:#FFFFFF;} input,textarea{font-family:inherit;}';
    document.head.appendChild(s);
  }, []);
}

export default function App() {
  useWebFonts();
  // 안드로이드 기본 한글 글꼴은 디자인과 달라서 Noto Sans KR을 싣는다(글꼴 이름은 kit의 T와 맞춘다)
  const [fontsReady] = useFonts(
    Platform.OS === 'android' ? { NotoSansKR_400Regular, NotoSansKR_500Medium, NotoSansKR_600SemiBold, NotoSansKR_700Bold } : {},
  );
  if (!fontsReady) return null;
  // 화면 크기 대응은 화면 안에서 한다(320~430px 폰은 꽉 채움, 768px 이상은 세로 메뉴·2열·가운데 600px)
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={qc}>
        <NavigationContainer theme={theme} onStateChange={onNavChange}>
          <StatusBar style="dark" />
          <Root />
        </NavigationContainer>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
