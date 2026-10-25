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
  /** 도감 묶음(동물·모양·사물·글자·겨울 한정) */
  category: string;
  /**
   * 성수·건대·왕십리 세 곳에서 3km·5km로 도로망 테스트를 돌려 6번 모두 경로가 나오고 부분별로도 잘 맞았던 그림.
   * 라이브러리 맨 앞에 '추천'으로 보여 준다(시연용)
   */
  pick?: boolean;
}

export const SHAPES: ShapeDef[] = [
  {
    key: 'whale',
    label: '고래',
    km: 7.4,
    library: true, category: '동물', pick: false,
    path: 'M30 100 L32 80 L50 62 L80 50 L110 42 L140 40 L170 42 L200 48 L222 62 L240 80 L250 100 L268 82 L290 70 L282 100 L290 130 L268 118 L250 110 L236 128 L210 142 L180 148 L140 150 L100 148 L66 140 L42 124 Z',
  },
  {
    key: 'heart',
    label: '하트',
    km: 3.2,
    library: true, category: '모양', pick: true,
    path: 'M50 68 L20 40 C10 29 16 13 30 14 C40 15 46 21 50 27 C54 21 60 15 70 14 C84 13 90 29 80 40 Z',
  },
  {
    key: 'rabbit',
    label: '토끼',
    km: 5.8,
    library: true, category: '동물', pick: true,
    path: 'M30 70 L28 50 L34 38 L30 12 L38 10 L42 34 L50 34 L54 10 L62 12 L58 38 L66 48 L80 50 L84 62 L74 70 Z',
  },
  {
    key: 'star',
    label: '별',
    km: 4.6,
    library: true, category: '모양', pick: false,
    path: 'M50 8 L60 32 L86 34 L66 50 L72 74 L50 61 L28 74 L34 50 L14 34 L40 32 Z',
  },
  {
    key: 'cat',
    label: '고양이',
    km: 10.3,
    library: true, category: '동물', pick: false,
    path: 'M110 440 C100 400 116 362 136 344 C126 298 122 252 140 228 C158 234 160 284 166 330 C176 322 192 322 202 330 C204 282 210 236 230 230 C246 248 236 302 226 346 C258 362 282 392 276 426 C272 454 236 464 190 462 C152 460 118 458 110 440 Z',
  },
  { key: 'bolt', label: '번개', km: 3.9, library: true, category: '모양', pick: false, path: 'M56 6 L28 44 L48 44 L40 74 L72 32 L52 32 Z' },
  {
    key: 'moon',
    label: '달',
    km: 4.8,
    library: true, category: '모양', pick: false,
    // 디자인의 원호(A) 두 개를 직선 근사로 옮긴 것
    path: 'M60 10 L48 12 L38 17 L30 25 L24 34 L21 44 L22 54 L27 62 L35 68 L45 71 L54 71 L60 70 L52 66 L45 59 L41 50 L40 40 L42 31 L47 22 L53 15 Z',
  },
  {
    key: 'fish',
    label: '물고기',
    km: 5.2,
    library: true, category: '동물', pick: false,
    path: 'M14 40 C30 18 60 18 74 40 C60 62 30 62 14 40 Z M74 40 L92 26 L92 54 Z',
  },
  // ---- 도로망 테스트(scripts/test-shapes.mjs)를 통과한 예시 그림. 직선과 큰 곡선 위주라 길에 잘 붙는다 ----
  { key: 'circle', label: '원', km: 3.4, library: true, category: '모양', pick: false, path: 'M50 8 C67.7 8 82 22.3 82 40 C82 57.7 67.7 72 50 72 C32.3 72 18 57.7 18 40 C18 22.3 32.3 8 50 8 Z' },
  { key: 'pentagon', label: '오각형', km: 3.6, library: true, category: '모양', pick: false, path: 'M50 6 L86 32 L72 74 L28 74 L14 32 Z' },
  { key: 'rect', label: '직사각형', km: 3.8, library: true, category: '모양', pick: true, path: 'M10 18 L90 18 L90 62 L10 62 Z' },
  { key: 'square', label: '네모', km: 3.4, library: true, category: '모양', pick: false, path: 'M20 10 L80 10 L80 70 L20 70 Z' },
  { key: 'triangle', label: '세모', km: 3.2, library: true, category: '모양', pick: true, path: 'M50 8 L88 72 L12 72 Z' },
  { key: 'diamond', label: '다이아몬드', km: 3.6, library: true, category: '모양', pick: true, path: 'M50 6 L84 40 L50 74 L16 40 Z' },
  { key: 'hexagon', label: '육각형', km: 3.8, library: true, category: '모양', pick: false, path: 'M30 8 L70 8 L90 40 L70 72 L30 72 L10 40 Z' },
  { key: 'plus', label: '십자', km: 4.4, library: true, category: '모양', pick: true, path: 'M38 8 L62 8 L62 28 L84 28 L84 52 L62 52 L62 72 L38 72 L38 52 L16 52 L16 28 L38 28 Z' },
  { key: 'arrow', label: '화살표', km: 4.2, library: true, category: '모양', pick: false, path: 'M10 30 L54 30 L54 12 L90 40 L54 68 L54 50 L10 50 Z' },
  { key: 'stairs', label: '계단', km: 4.4, library: true, category: '모양', pick: true, path: 'M12 72 L12 56 L32 56 L32 40 L52 40 L52 24 L72 24 L72 8 L88 8 L88 72 Z' },
  { key: 'gem', label: '보석', km: 3.8, library: true, category: '모양', pick: true, path: 'M30 12 L70 12 L88 30 L50 74 L12 30 Z' },
  { key: 'house', label: '집', km: 3.6, library: true, category: '사물', pick: true, path: 'M22 72 L22 36 L50 10 L78 36 L78 72 Z' },
  { key: 'crown', label: '왕관', km: 4.6, library: true, category: '사물', pick: true, path: 'M14 68 L14 22 L32 44 L50 14 L68 44 L86 22 L86 68 Z' },
  { key: 'tree', label: '트리', km: 5.2, library: true, category: '사물', pick: true, path: 'M50 6 L72 30 L62 30 L80 52 L58 52 L58 72 L42 72 L42 52 L20 52 L38 30 L28 30 Z' },
  { key: 'cup', label: '커피컵', km: 4.4, library: true, category: '사물', pick: false, path: 'M20 16 L68 16 L66 30 L80 30 L80 50 L64 50 L62 70 L26 70 Z' },
  { key: 'rocket', label: '로켓', km: 5.0, library: true, category: '사물', pick: false, path: 'M50 4 L64 22 L64 54 L76 70 L60 64 L40 64 L24 70 L36 54 L36 22 Z' },
  { key: 'shirt', label: '티셔츠', km: 5.6, library: true, category: '사물', pick: true, path: 'M34 10 L44 16 L56 16 L66 10 L88 24 L80 38 L70 32 L70 72 L30 72 L30 32 L20 38 L12 24 Z' },
  { key: 'balloon', label: '풍선', km: 4.0, library: true, category: '사물', pick: true, path: 'M50 56 C24 56 22 8 50 8 C78 8 76 56 50 56 L44 74 L56 74 Z' },
  { key: 'letterT', label: 'T', km: 4.2, library: true, category: '글자', pick: false, path: 'M14 8 L86 8 L86 24 L58 24 L58 72 L42 72 L42 24 L14 24 Z' },
  { key: 'letterL', label: 'L', km: 3.6, library: true, category: '글자', pick: true, path: 'M24 8 L42 8 L42 56 L80 56 L80 72 L24 72 Z' },
  { key: 'letterH', label: 'H', km: 5.4, library: true, category: '글자', pick: false, path: 'M16 8 L34 8 L34 32 L66 32 L66 8 L84 8 L84 72 L66 72 L66 48 L34 48 L34 72 L16 72 Z' },
  { key: 'letterU', label: 'U', km: 4.4, library: true, category: '글자', pick: true, path: 'M18 8 L36 8 L36 54 L64 54 L64 8 L82 8 L82 72 L18 72 Z' },
  { key: 'num1', label: '1', km: 4.0, library: true, category: '글자', pick: true, path: 'M40 8 L58 8 L58 58 L72 58 L72 72 L28 72 L28 58 L42 58 L42 26 L30 30 L30 16 Z' },
  { key: 'dog', label: '강아지', km: 5.0, library: true, category: '동물', pick: true, path: 'M25 70 L25 40 L18 20 L33 30 L50 30 L65 20 L60 40 L76 46 L80 70 Z' },
  { key: 'bird', label: '새', km: 3.0, library: true, category: '동물', pick: false, path: 'M10 46 C24 30 40 30 50 42 C60 30 76 30 90 46' },
  { key: 'snow', label: '눈사람', km: 4.2, library: true, category: '겨울 한정', pick: true, path: 'M50 32 C40 32 38 8 50 8 C62 8 60 32 50 32 C30 32 26 72 50 72 C74 72 70 32 50 32 Z' },
  { key: 'leaf', label: '낙엽', km: 4.0, library: true, category: '겨울 한정', pick: false, path: 'M20 66 C20 30 46 12 80 12 C80 46 60 68 20 66 L58 32' },
  { key: 'flower', label: '꽃', km: 5.6, library: true, category: '겨울 한정', pick: true, path: 'M50 40 C36 24 44 8 50 8 C56 8 64 24 50 40 C66 26 82 34 82 40 C82 46 66 54 50 40 C64 56 56 72 50 72 C44 72 36 56 50 40 C34 54 18 46 18 40 C18 34 34 26 50 40 Z' },
  { key: 'melon', label: '수박', km: 3.6, library: true, category: '겨울 한정', pick: false, path: 'M12 28 C12 80 88 80 88 28 Z' },
  { key: 'turtle', label: '거북이', km: 5.4, library: true, category: '동물', pick: true, path: 'M20 52 C20 24 70 24 70 52 L82 46 L90 52 L82 58 L70 52 L66 64 L58 58 L32 58 L24 64 Z' },
  { key: 'duck', label: '오리', km: 4.8, library: true, category: '동물', pick: true, path: 'M20 46 C20 64 76 64 76 46 L64 46 L64 24 C64 12 46 12 46 24 L36 24 L46 30 L46 46 Z' },
  { key: 'penguin', label: '펭귄', km: 5.8, library: true, category: '동물', pick: false, path: 'M50 6 C30 6 26 30 30 44 L18 54 L30 52 L32 72 L68 72 L70 52 L82 54 L70 44 C74 30 70 6 50 6 Z' },
  { key: 'car', label: '자동차', km: 4.6, library: true, category: '사물', pick: true, path: 'M10 60 L10 42 L26 40 L36 24 L66 24 L76 40 L90 42 L90 60 Z' },
  { key: 'key', label: '열쇠', km: 4.4, library: true, category: '사물', pick: true, path: 'M10 40 C10 22 36 22 36 40 C36 58 10 58 10 40 M36 40 L90 40 L90 52 L80 52 L80 46 L70 46 L70 52 L60 52 L60 46 L36 46' },
  { key: 'music', label: '음표', km: 4.6, library: true, category: '사물', pick: true, path: 'M28 70 C16 70 16 54 30 54 L40 54 L40 12 L76 6 L76 20 L52 24 L52 62 C52 70 40 70 28 70 Z' },
  { key: 'smile', label: '스마일', km: 3.8, library: true, category: '모양', pick: false, path: 'M50 8 C92 8 92 72 50 72 C8 72 8 8 50 8 Z' },
  { key: 'peace', label: '브이', km: 4.2, library: true, category: '모양', pick: true, path: 'M18 8 L36 8 L50 46 L64 8 L82 8 L58 72 L42 72 Z' },
  { key: 'zigzag', label: '지그재그', km: 4.0, library: true, category: '모양', pick: true, path: 'M10 70 L26 14 L42 70 L58 14 L74 70 L90 14' },
  { key: 'infinity', label: '무한대', km: 4.8, library: true, category: '모양', pick: true, path: 'M50 40 C40 20 12 20 12 40 C12 60 40 60 50 40 C60 20 88 20 88 40 C88 60 60 60 50 40 Z' },
  { key: 'octagon', label: '팔각형', km: 3.8, library: true, category: '모양', pick: false, path: 'M34 6 L66 6 L88 26 L88 54 L66 74 L34 74 L12 54 L12 26 Z' },
  { key: 'trapezoid', label: '사다리꼴', km: 3.6, library: true, category: '모양', pick: true, path: 'M30 14 L70 14 L90 66 L10 66 Z' },
  { key: 'parallelogram', label: '평행사변형', km: 3.8, library: true, category: '모양', pick: true, path: 'M30 16 L90 16 L70 64 L10 64 Z' },
  { key: 'drop', label: '물방울', km: 3.4, library: true, category: '모양', pick: true, path: 'M50 6 L74 42 C84 60 72 74 50 74 C28 74 16 60 26 42 Z' },
  { key: 'cloud', label: '구름', km: 4.2, library: true, category: '모양', pick: true, path: 'M20 64 C6 64 6 44 20 42 C18 26 38 20 46 30 C52 14 76 16 76 34 C92 34 94 64 78 64 Z' },
  { key: 'tshape', label: '망치', km: 4.0, library: true, category: '사물', pick: true, path: 'M14 12 L86 12 L86 30 L58 30 L58 72 L42 72 L42 30 L14 30 Z' },
  { key: 'flag', label: '깃발', km: 3.8, library: true, category: '사물', pick: true, path: 'M24 74 L24 8 L80 8 L66 24 L80 40 L32 40 L32 74 Z' },
  { key: 'envelope', label: '편지', km: 4.2, library: true, category: '사물', pick: false, path: 'M10 14 L90 14 L90 66 L10 66 Z M10 14 L50 44 L90 14' },
  { key: 'gift', label: '선물상자', km: 4.6, library: true, category: '사물', pick: true, path: 'M14 28 L86 28 L86 72 L14 72 Z M50 28 L50 72 M14 44 L86 44' },
  { key: 'mug', label: '머그컵', km: 4.0, library: true, category: '사물', pick: true, path: 'M16 12 L64 12 L64 30 L80 30 L80 54 L64 54 L64 72 L16 72 Z' },
  { key: 'tv', label: '텔레비전', km: 4.2, library: true, category: '사물', pick: true, path: 'M10 22 L90 22 L90 70 L10 70 Z M34 22 L50 8 L66 22' },
  { key: 'butterfly', label: '나비', km: 4.6, library: true, category: '동물', pick: true, path: 'M50 40 L22 10 L10 30 L24 40 L10 52 L22 70 L50 40 L78 70 L90 52 L76 40 L90 30 L78 10 Z' },
  { key: 'snail', label: '달팽이', km: 4.4, library: true, category: '동물', pick: true, path: 'M10 70 L90 70 L84 60 L70 60 L70 28 L40 28 L40 46 L56 46 L56 38' },
  { key: 'letterE', label: 'E', km: 4.4, library: true, category: '글자', pick: true, path: 'M70 8 L24 8 L24 72 L70 72 M24 40 L62 40' },
  { key: 'letterN', label: 'N', km: 4.0, library: true, category: '글자', pick: false, path: 'M18 72 L18 8 L82 72 L82 8' },
  { key: 'letterZ', label: 'Z', km: 3.8, library: true, category: '글자', pick: true, path: 'M16 8 L84 8 L16 72 L84 72' },
  { key: 'letterM', label: 'M', km: 4.6, library: true, category: '글자', pick: true, path: 'M10 72 L10 8 L50 46 L90 8 L90 72' },
  { key: 'num7', label: '7', km: 3.4, library: true, category: '글자', pick: false, path: 'M16 8 L84 8 L44 72' },
  { key: 'num4', label: '4', km: 3.8, library: true, category: '글자', pick: false, path: 'M62 72 L62 8 L14 52 L88 52' },
  { key: 'hangulR', label: 'ㄹ', km: 4.4, library: true, category: '글자', pick: true, path: 'M18 8 L82 8 L82 40 L18 40 L18 72 L82 72' },
];

/** 도감 묶음 순서와 보상 문구. opensAt이 있으면 그날까지 ?로 잠근다 */
export const SETS: { name: string; reward: string; opensAt?: string }[] = [
  { name: '동물', reward: '다 모으면 동물원 배지' },
  { name: '모양', reward: '다 모으면 도형 마스터 배지' },
  { name: '사물', reward: '다 모으면 수집가 배지' },
  { name: '글자', reward: '다 모으면 타이포 러너 배지' },
  { name: '겨울 한정', reward: '12월 1일에 열려요', opensAt: '2026-12-01' },
];

export const shapeByKey = (key: string) => SHAPES.find((s) => s.key === key);

export function difficultyOf(km: number): '쉬움' | '보통' | '어려움' {
  if (km < 5) return '쉬움';
  if (km < 10) return '보통';
  return '어려움';
}
