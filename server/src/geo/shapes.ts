// 그림 라이브러리. path는 디자인 캔버스의 SVG 좌표(절대 M/L/C/Z)를 그대로 쓴다.
// 서버는 이 path를 폴리라인으로 펼쳐 실제 지도 좌표로 옮긴다.

export interface ShapeDef {
  key: string;
  label: string;
  /** 라이브러리에서 고를 수 있는 기본 거리(km) */
  km: number;
  path: string;
  /** 크루 챌린지 라이브러리에 노출 */
  library: boolean;
}

export const SHAPES: ShapeDef[] = [
  {
    key: 'whale',
    label: '고래',
    km: 7.4,
    library: true,
    path: 'M30 100 L32 80 L50 62 L80 50 L110 42 L140 40 L170 42 L200 48 L222 62 L240 80 L250 100 L268 82 L290 70 L282 100 L290 130 L268 118 L250 110 L236 128 L210 142 L180 148 L140 150 L100 148 L66 140 L42 124 Z',
  },
  {
    key: 'heart',
    label: '하트',
    km: 3.2,
    library: true,
    path: 'M50 68 L20 40 C10 29 16 13 30 14 C40 15 46 21 50 27 C54 21 60 15 70 14 C84 13 90 29 80 40 Z',
  },
  {
    key: 'rabbit',
    label: '토끼',
    km: 5.8,
    library: true,
    path: 'M30 70 L28 50 L34 38 L30 12 L38 10 L42 34 L50 34 L54 10 L62 12 L58 38 L66 48 L80 50 L84 62 L74 70 Z',
  },
  {
    key: 'star',
    label: '별',
    km: 4.6,
    library: true,
    path: 'M50 8 L60 32 L86 34 L66 50 L72 74 L50 61 L28 74 L34 50 L14 34 L40 32 Z',
  },
  {
    key: 'cat',
    label: '고양이',
    km: 10.3,
    library: false,
    path: 'M110 440 C100 400 116 362 136 344 C126 298 122 252 140 228 C158 234 160 284 166 330 C176 322 192 322 202 330 C204 282 210 236 230 230 C246 248 236 302 226 346 C258 362 282 392 276 426 C272 454 236 464 190 462 C152 460 118 458 110 440 Z',
  },
  { key: 'bolt', label: '번개', km: 3.9, library: false, path: 'M56 6 L28 44 L48 44 L40 74 L72 32 L52 32 Z' },
  {
    key: 'moon',
    label: '달',
    km: 4.8,
    library: false,
    // 디자인의 원호(A) 두 개를 직선 근사로 옮긴 것
    path: 'M60 10 L48 12 L38 17 L30 25 L24 34 L21 44 L22 54 L27 62 L35 68 L45 71 L54 71 L60 70 L52 66 L45 59 L41 50 L40 40 L42 31 L47 22 L53 15 Z',
  },
  {
    key: 'fish',
    label: '물고기',
    km: 5.2,
    library: false,
    path: 'M14 40 C30 18 60 18 74 40 C60 62 30 62 14 40 Z M74 40 L92 26 L92 54 Z',
  },
];

export const shapeByKey = (key: string) => SHAPES.find((s) => s.key === key);

export function difficultyOf(km: number): '쉬움' | '보통' | '어려움' {
  if (km < 5) return '쉬움';
  if (km < 10) return '보통';
  return '어려움';
}
