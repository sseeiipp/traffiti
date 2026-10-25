export const RECORD_COLORS = [
  '#2B63F0',
  '#F26B1D',
  '#0E9384',
  '#7A5AF8',
  '#C24E0E',
  '#0891B2',
  '#DB2777',
  '#A16207',
  '#65A30D',
  '#EF4444',
  '#14B8A6',
  '#F59E0B',
];

const toRgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

export function colorDistance(a: string, b: string) {
  const x = toRgb(a);
  const y = toRgb(b);
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
}

/** 같은 크루 안에서 이 거리보다 가까운 색은 고를 수 없다 */
export const COLOR_CLASH = 70;

export function pickFreeColor(taken: string[]): string {
  return (
    RECORD_COLORS.find((c) => taken.every((t) => colorDistance(c, t) >= COLOR_CLASH)) ??
    '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0').toUpperCase()
  );
}

export const randomCode = () => String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0');

/** 크루 이름·그림 이름 금칙어(최소 목록) */
const BANNED = ['시발', '씨발', '병신', '개새', '좆', 'fuck', 'shit'];
export const hasBannedWord = (s: string) => BANNED.some((w) => s.toLowerCase().includes(w));

export const KST = 'Asia/Seoul';

/** 'YYYY-MM' (한국 시간) */
export function monthKey(d = new Date()): string {
  const s = new Intl.DateTimeFormat('en-CA', { timeZone: KST, year: 'numeric', month: '2-digit' }).format(d);
  return s.slice(0, 7);
}

export function prevMonthKey(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}

/** 크루 레벨: 레벨마다 1,000 XP */
export function levelOf(totalXp: number) {
  const level = Math.floor(totalXp / 1000) + 1;
  const into = totalXp % 1000;
  const TITLES: [number, string][] = [
    [15, '전설의 붓'],
    [10, '도시 화가'],
    [7, '그림 탐험가'],
    [5, '골목 화가'],
    [3, '동네 러너'],
    [1, '첫 발자국'],
  ];
  return { level, into, toNext: 1000 - into, title: TITLES.find(([lv]) => level >= lv)![1] };
}

export function tierOf(pct: number) {
  if (pct >= 98) return '다이아';
  if (pct >= 92) return '골드';
  if (pct >= 85) return '실버';
  return '브론즈';
}

/** 점수 내림차순 정렬 후 SQL RANK()와 같은 순위(동점은 같은 순위, 다음 순위는 건너뜀) */
export function competitionRank<T extends { score: number }>(rows: T[]): (T & { rank: number })[] {
  const sorted = [...rows].sort((a, b) => b.score - a.score);
  return sorted.map((r) => ({ ...r, rank: 1 + sorted.filter((o) => o.score > r.score).length }));
}
