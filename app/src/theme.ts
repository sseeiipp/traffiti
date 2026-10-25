import { Platform } from 'react-native';

// 디자인 캔버스 '공통 컴포넌트 · 스타일' 보드의 값
export const C = {
  bg: '#FFFFFF',
  ink: '#1D1D1F',
  sub: '#6E6E73',
  sub2: '#8E8E93',
  sub3: '#AEAEB2',
  body2: '#3A3A3C',
  lime: '#A3E635',
  limeGlass: 'rgba(163, 230, 53, 0.9)',
  limeEdge: '#84CC16',
  limeText: '#3F6212',
  limeDeep: '#2E3A12',
  limeSoft: '#ECFCCB',
  toggle: '#65A30D',
  fill: 'rgba(120, 120, 128, 0.12)',
  field: '#F2F2F7',
  soft: '#F5F5F7',
  seg: '#EBEBF0',
  line: '#E5E5EA',
  danger: '#D92D20',
  target: '#C7330A',
  map: { land: '#EEF1EA', water: '#D3E2E8', park: '#D9EDC2', road: '#FFFFFF', minor: '#F7F8F5' },
  members: ['#2B63F0', '#F26B1D', '#0E9384', '#7A5AF8'],
};

export const shadow = {
  /** 흰 보조 버튼·칩 */
  soft: '0 0 0 0.5px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.06), 0 3px 10px rgba(0, 0, 0, 0.05)',
  /** 선택한 카드(연두 그림자) */
  selected: '0 10px 28px rgba(101, 163, 13, 0.28), 0 2px 6px rgba(101, 163, 13, 0.16)',
  chipOn: '0 2px 10px rgba(101, 163, 13, 0.28)',
  sheet: '0 20px 50px rgba(0, 0, 0, 0.18)',
  glass: '0 0 0 0.5px rgba(255, 255, 255, 0.6), 0 4px 18px rgba(0, 0, 0, 0.06)',
  lime: '0 6px 18px rgba(101, 163, 13, 0.28)',
};

export const font = Platform.select({
  web: {
    text: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Apple SD Gothic Neo', Inter, 'Noto Sans KR', system-ui, sans-serif",
    rounded: "ui-rounded, 'SF Pro Rounded', -apple-system, BlinkMacSystemFont, Inter, 'Noto Sans KR', sans-serif",
  },
  default: { text: undefined, rounded: undefined },
})!;

/** 누르면 살짝 작아졌다 스프링처럼 돌아오는 움직임 */
export const PRESS = { scale: 0.96, inMs: 120, outMs: 340 };
