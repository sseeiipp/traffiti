// 디자인 캔버스의 그림 아이콘(SVG path, viewBox, 선 굵기)
export interface ShapeIcon {
  label: string;
  box: string;
  d: string;
  sw: number;
}

const B = '0 0 100 80';

export const SHAPE_ICONS: Record<string, ShapeIcon> = {
  whale: {
    label: '고래',
    box: '20 30 290 130',
    sw: 14,
    d: 'M30 100 L32 80 L50 62 L80 50 L110 42 L140 40 L170 42 L200 48 L222 62 L240 80 L250 100 L268 82 L290 70 L282 100 L290 130 L268 118 L250 110 L236 128 L210 142 L180 148 L140 150 L100 148 L66 140 L42 124 Z',
  },
  heart: { label: '하트', box: '8 6 84 68', sw: 5, d: 'M50 68 L20 40 C10 29 16 13 30 14 C40 15 46 21 50 27 C54 21 60 15 70 14 C84 13 90 29 80 40 Z' },
  star: { label: '별', box: '8 4 84 74', sw: 5, d: 'M50 8 L60 32 L86 34 L66 50 L72 74 L50 61 L28 74 L34 50 L14 34 L40 32 Z' },
  rabbit: { label: '토끼', box: '18 4 72 72', sw: 5, d: 'M30 70 L28 50 L34 38 L30 12 L38 10 L42 34 L50 34 L54 10 L62 12 L58 38 L66 48 L80 50 L84 62 L74 70 Z' },
  cat: {
    label: '고양이',
    box: '96 220 192 250',
    sw: 13,
    d: 'M110 440 C100 400 116 362 136 344 C126 298 122 252 140 228 C158 234 160 284 166 330 C176 322 192 322 202 330 C204 282 210 236 230 230 C246 248 236 302 226 346 C258 362 282 392 276 426 C272 454 236 464 190 462 C152 460 118 458 110 440 Z',
  },
  bolt: { label: '번개', box: B, sw: 5, d: 'M56 6 L28 44 L48 44 L40 74 L72 32 L52 32 Z' },
  moon: { label: '달', box: B, sw: 5, d: 'M60 10 A30 30 0 1 0 60 70 A24 24 0 1 1 60 10 Z' },
  fish: { label: '물고기', box: B, sw: 5, d: 'M14 40 C30 18 60 18 74 40 C60 62 30 62 14 40 Z M74 40 L92 26 L92 54 Z' },
  dog: { label: '강아지', box: B, sw: 5, d: 'M25 70 L25 40 L18 20 L33 30 L50 30 L65 20 L60 40 L76 46 L80 70 Z' },
  bird: { label: '새', box: B, sw: 5, d: 'M10 46 C24 30 40 30 50 42 C60 30 76 30 90 46' },
  snow: { label: '눈사람', box: B, sw: 5, d: 'M38 20 a12 12 0 1 0 24 0 a12 12 0 1 0 -24 0 M30 54 a20 20 0 1 0 40 0 a20 20 0 1 0 -40 0' },
  leaf: { label: '낙엽', box: B, sw: 5, d: 'M20 66 C20 30 46 12 80 12 C80 46 60 68 20 66 Z M20 66 L58 32' },
  flower: {
    label: '꽃',
    box: B,
    sw: 5,
    d: 'M50 12 C62 12 62 30 50 34 C38 30 38 12 50 12 Z M50 68 C38 68 38 50 50 46 C62 50 62 68 50 68 Z M22 40 C22 28 40 28 44 40 C40 52 22 52 22 40 Z M78 40 C78 52 60 52 56 40 C60 28 78 28 78 40 Z',
  },
  melon: { label: '수박', box: B, sw: 5, d: 'M12 28 A38 38 0 0 0 88 28 Z M24 32 A26 26 0 0 0 76 32' },
  // 도로망 테스트를 통과한 예시 그림(server/src/geo/shapes.ts와 같은 path)
  circle: { label: '원', box: B, sw: 5, d: 'M50 8 C67.7 8 82 22.3 82 40 C82 57.7 67.7 72 50 72 C32.3 72 18 57.7 18 40 C18 22.3 32.3 8 50 8 Z' },
  pentagon: { label: '오각형', box: B, sw: 5, d: 'M50 6 L86 32 L72 74 L28 74 L14 32 Z' },
  rect: { label: '직사각형', box: B, sw: 5, d: 'M10 18 L90 18 L90 62 L10 62 Z' },
  square: { label: '네모', box: B, sw: 5, d: 'M20 10 L80 10 L80 70 L20 70 Z' },
  triangle: { label: '세모', box: B, sw: 5, d: 'M50 8 L88 72 L12 72 Z' },
  diamond: { label: '다이아몬드', box: B, sw: 5, d: 'M50 6 L84 40 L50 74 L16 40 Z' },
  hexagon: { label: '육각형', box: B, sw: 5, d: 'M30 8 L70 8 L90 40 L70 72 L30 72 L10 40 Z' },
  plus: { label: '십자', box: B, sw: 5, d: 'M38 8 L62 8 L62 28 L84 28 L84 52 L62 52 L62 72 L38 72 L38 52 L16 52 L16 28 L38 28 Z' },
  arrow: { label: '화살표', box: B, sw: 5, d: 'M10 30 L54 30 L54 12 L90 40 L54 68 L54 50 L10 50 Z' },
  stairs: { label: '계단', box: B, sw: 5, d: 'M12 72 L12 56 L32 56 L32 40 L52 40 L52 24 L72 24 L72 8 L88 8 L88 72 Z' },
  gem: { label: '보석', box: B, sw: 5, d: 'M30 12 L70 12 L88 30 L50 74 L12 30 Z' },
  house: { label: '집', box: B, sw: 5, d: 'M22 72 L22 36 L50 10 L78 36 L78 72 Z' },
  crown: { label: '왕관', box: B, sw: 5, d: 'M14 68 L14 22 L32 44 L50 14 L68 44 L86 22 L86 68 Z' },
  tree: { label: '트리', box: B, sw: 5, d: 'M50 6 L72 30 L62 30 L80 52 L58 52 L58 72 L42 72 L42 52 L20 52 L38 30 L28 30 Z' },
  cup: { label: '커피컵', box: B, sw: 5, d: 'M20 16 L68 16 L66 30 L80 30 L80 50 L64 50 L62 70 L26 70 Z' },
  rocket: { label: '로켓', box: B, sw: 5, d: 'M50 4 L64 22 L64 54 L76 70 L60 64 L40 64 L24 70 L36 54 L36 22 Z' },
  shirt: { label: '티셔츠', box: B, sw: 5, d: 'M34 10 L44 16 L56 16 L66 10 L88 24 L80 38 L70 32 L70 72 L30 72 L30 32 L20 38 L12 24 Z' },
  balloon: { label: '풍선', box: B, sw: 5, d: 'M50 56 C24 56 22 8 50 8 C78 8 76 56 50 56 L44 74 L56 74 Z' },
  letterT: { label: 'T', box: B, sw: 5, d: 'M14 8 L86 8 L86 24 L58 24 L58 72 L42 72 L42 24 L14 24 Z' },
  letterL: { label: 'L', box: B, sw: 5, d: 'M24 8 L42 8 L42 56 L80 56 L80 72 L24 72 Z' },
  letterH: { label: 'H', box: B, sw: 5, d: 'M16 8 L34 8 L34 32 L66 32 L66 8 L84 8 L84 72 L66 72 L66 48 L34 48 L34 72 L16 72 Z' },
  letterU: { label: 'U', box: B, sw: 5, d: 'M18 8 L36 8 L36 54 L64 54 L64 8 L82 8 L82 72 L18 72 Z' },
  num1: { label: '1', box: B, sw: 5, d: 'M40 8 L58 8 L58 58 L72 58 L72 72 L28 72 L28 58 L42 58 L42 26 L30 30 L30 16 Z' },
  turtle: { label: '거북이', box: B, sw: 5, d: 'M20 52 C20 24 70 24 70 52 L82 46 L90 52 L82 58 L70 52 L66 64 L58 58 L32 58 L24 64 Z' },
  duck: { label: '오리', box: B, sw: 5, d: 'M20 46 C20 64 76 64 76 46 L64 46 L64 24 C64 12 46 12 46 24 L36 24 L46 30 L46 46 Z' },
  penguin: { label: '펭귄', box: B, sw: 5, d: 'M50 6 C30 6 26 30 30 44 L18 54 L30 52 L32 72 L68 72 L70 52 L82 54 L70 44 C74 30 70 6 50 6 Z' },
  car: { label: '자동차', box: B, sw: 5, d: 'M10 60 L10 42 L26 40 L36 24 L66 24 L76 40 L90 42 L90 60 Z' },
  key: { label: '열쇠', box: B, sw: 5, d: 'M10 40 C10 22 36 22 36 40 C36 58 10 58 10 40 M36 40 L90 40 L90 52 L80 52 L80 46 L70 46 L70 52 L60 52 L60 46 L36 46' },
  music: { label: '음표', box: B, sw: 5, d: 'M28 70 C16 70 16 54 30 54 L40 54 L40 12 L76 6 L76 20 L52 24 L52 62 C52 70 40 70 28 70 Z' },
  smile: { label: '스마일', box: B, sw: 5, d: 'M50 8 C92 8 92 72 50 72 C8 72 8 8 50 8 Z' },
  peace: { label: '브이', box: B, sw: 5, d: 'M18 8 L36 8 L50 46 L64 8 L82 8 L58 72 L42 72 Z' },
  zigzag: { label: '지그재그', box: B, sw: 5, d: 'M10 70 L26 14 L42 70 L58 14 L74 70 L90 14' },
  infinity: { label: '무한대', box: B, sw: 5, d: 'M50 40 C40 20 12 20 12 40 C12 60 40 60 50 40 C60 20 88 20 88 40 C88 60 60 60 50 40 Z' },
  custom: {
    label: '직접 그린 코스',
    box: '96 220 192 250',
    sw: 13,
    d: 'M110 440 C100 400 116 362 136 344 C126 298 122 252 140 228 C158 234 160 284 166 330 C176 322 192 322 202 330 C204 282 210 236 230 230 C246 248 236 302 226 346 C258 362 282 392 276 426 C272 454 236 464 190 462 C152 460 118 458 110 440 Z',
  },
  octagon: { label: '팔각형', box: B, sw: 5, d: 'M34 6 L66 6 L88 26 L88 54 L66 74 L34 74 L12 54 L12 26 Z' },
  trapezoid: { label: '사다리꼴', box: B, sw: 5, d: 'M30 14 L70 14 L90 66 L10 66 Z' },
  parallelogram: { label: '평행사변형', box: B, sw: 5, d: 'M30 16 L90 16 L70 64 L10 64 Z' },
  drop: { label: '물방울', box: B, sw: 5, d: 'M50 6 L74 42 C84 60 72 74 50 74 C28 74 16 60 26 42 Z' },
  cloud: { label: '구름', box: B, sw: 5, d: 'M20 64 C6 64 6 44 20 42 C18 26 38 20 46 30 C52 14 76 16 76 34 C92 34 94 64 78 64 Z' },
  tshape: { label: '망치', box: B, sw: 5, d: 'M14 12 L86 12 L86 30 L58 30 L58 72 L42 72 L42 30 L14 30 Z' },
  flag: { label: '깃발', box: B, sw: 5, d: 'M24 74 L24 8 L80 8 L66 24 L80 40 L32 40 L32 74 Z' },
  envelope: { label: '편지', box: B, sw: 5, d: 'M10 14 L90 14 L90 66 L10 66 Z M10 14 L50 44 L90 14' },
  gift: { label: '선물상자', box: B, sw: 5, d: 'M14 28 L86 28 L86 72 L14 72 Z M50 28 L50 72 M14 44 L86 44' },
  mug: { label: '머그컵', box: B, sw: 5, d: 'M16 12 L64 12 L64 30 L80 30 L80 54 L64 54 L64 72 L16 72 Z' },
  tv: { label: '텔레비전', box: B, sw: 5, d: 'M10 22 L90 22 L90 70 L10 70 Z M34 22 L50 8 L66 22' },
  butterfly: { label: '나비', box: B, sw: 5, d: 'M50 40 L22 10 L10 30 L24 40 L10 52 L22 70 L50 40 L78 70 L90 52 L76 40 L90 30 L78 10 Z' },
  snail: { label: '달팽이', box: B, sw: 5, d: 'M10 70 L90 70 L84 60 L70 60 L70 28 L40 28 L40 46 L56 46 L56 38' },
  letterE: { label: 'E', box: B, sw: 5, d: 'M70 8 L24 8 L24 72 L70 72 M24 40 L62 40' },
  letterN: { label: 'N', box: B, sw: 5, d: 'M18 72 L18 8 L82 72 L82 8' },
  letterZ: { label: 'Z', box: B, sw: 5, d: 'M16 8 L84 8 L16 72 L84 72' },
  letterM: { label: 'M', box: B, sw: 5, d: 'M10 72 L10 8 L50 46 L90 8 L90 72' },
  num7: { label: '7', box: B, sw: 5, d: 'M16 8 L84 8 L44 72' },
  num4: { label: '4', box: B, sw: 5, d: 'M62 72 L62 8 L14 52 L88 52' },
  hangulR: { label: 'ㄹ', box: B, sw: 5, d: 'M18 8 L82 8 L82 40 L18 40 L18 72 L82 72' },
};

export const shapeLabel = (k: string) => SHAPE_ICONS[k]?.label ?? k;

/** 친구와 달리기에서 고르는 그림(앞 8개는 바로 고르는 칩, 나머지는 '더 고르기'). 도로망 테스트 추천 그림 위주 */
export const FRIEND_SHAPES = [
  'heart', 'star', 'whale', 'rabbit', 'house', 'balloon', 'diamond', 'music',
  'cat', 'bolt', 'moon', 'fish', 'infinity', 'crown', 'car', 'key', 'duck', 'turtle', 'stairs', 'letterU',
];
