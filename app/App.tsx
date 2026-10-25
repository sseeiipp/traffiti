import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Root } from './src/navigation/Root';

const qc = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 15_000 } } });

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
  // 화면 크기 대응은 화면 안에서 한다(320~430px 폰은 꽉 채움, 768px 이상은 세로 메뉴·2열·가운데 600px)
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={qc}>
        <NavigationContainer theme={theme}>
          <StatusBar style="dark" />
          <Root />
        </NavigationContainer>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
