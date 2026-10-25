import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { C } from '../theme';

type P = { size?: number; color?: string; w?: number };

const S = ({ size = 22, children }: { size?: number; children: React.ReactNode }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    {children}
  </Svg>
);
const line = (color: string, w: number) => ({ stroke: color, strokeWidth: w, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const });

export const IcBack = ({ size = 22, color = C.ink, w = 2 }: P) => (
  <S size={size}><Path d="M15 5l-7 7 7 7" {...line(color, w)} /></S>
);
export const IcClose = ({ size = 20, color = C.ink, w = 2.2 }: P) => (
  <S size={size}><Path d="M6 6l12 12M18 6L6 18" {...line(color, w)} /></S>
);
export const IcChevron = ({ size = 14, color = C.sub3, w = 2.6 }: P) => (
  <S size={size}><Path d="M9 5l7 7-7 7" {...line(color, w)} /></S>
);
export const IcDown = ({ size = 16, color = C.sub, w = 2.6 }: P) => (
  <S size={size}><Path d="M6 9l6 6 6-6" {...line(color, w)} /></S>
);
export const IcPlus = ({ size = 18, color = C.ink, w = 2.2 }: P) => (
  <S size={size}><Path d="M12 5v14M5 12h14" {...line(color, w)} /></S>
);
export const IcCheck = ({ size = 18, color = C.limeText, w = 3 }: P) => (
  <S size={size}><Path d="M5 12.5l4.5 4.5L19 7.5" {...line(color, w)} /></S>
);
export const IcPlay = ({ size = 16, color = C.ink }: P) => (
  <S size={size}><Path d="M7 4.5v15l12-7.5z" fill={color} /></S>
);
export const IcPause = ({ size = 22, color = C.ink }: P) => (
  <S size={size}>
    <Rect x={6} y={5} width={4} height={14} rx={1} fill={color} />
    <Rect x={14} y={5} width={4} height={14} rx={1} fill={color} />
  </S>
);
export const IcLocate = ({ size = 18, color = C.ink }: P) => (
  <S size={size}><Path d="M20.5 3.5 3.8 10.6c-.8.4-.7 1.5.1 1.7l6.6 1.6 1.6 6.6c.2.8 1.3.9 1.7.1z" fill={color} /></S>
);
export const IcShare = ({ size = 22, color = C.ink, w = 1.9 }: P) => (
  <S size={size}>
    <Path d="M12 15V3M7 8l5-5 5 5" {...line(color, w)} />
    <Path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" {...line(color, w)} />
  </S>
);
export const IcDownload = ({ size = 18, color = C.ink, w = 2 }: P) => (
  <S size={size}>
    <Path d="M12 4v11M7 10l5 5 5-5" {...line(color, w)} />
    <Path d="M5 19h14" {...line(color, w)} />
  </S>
);
export const IcLink = ({ size = 22, color = C.ink, w = 1.9 }: P) => (
  <S size={size}>
    <Path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" {...line(color, w)} />
    <Path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" {...line(color, w)} />
  </S>
);
export const IcMore = ({ size = 22, color = C.ink }: P) => (
  <S size={size}>
    <Circle cx={5} cy={12} r={1.8} fill={color} />
    <Circle cx={12} cy={12} r={1.8} fill={color} />
    <Circle cx={19} cy={12} r={1.8} fill={color} />
  </S>
);
export const IcSearch = ({ size = 16, color = C.sub2, w = 2.2 }: P) => (
  <S size={size}>
    <Circle cx={11} cy={11} r={7} {...line(color, w)} />
    <Path d="M20 20l-3.5-3.5" {...line(color, w)} />
  </S>
);
export const IcLock = ({ size = 13, color = C.ink, w = 2.2 }: P) => (
  <S size={size}>
    <Rect x={5} y={11} width={14} height={10} rx={2} {...line(color, w)} />
    <Path d="M8 11V8a4 4 0 0 1 8 0v3" {...line(color, w)} />
  </S>
);
export const IcCamera = ({ size = 14, color = C.ink, w = 2 }: P) => (
  <S size={size}>
    <Path d="M4 8h3l2-3h6l2 3h3v11H4z" {...line(color, w)} />
    <Circle cx={12} cy={13} r={3.5} {...line(color, w)} />
  </S>
);
export const IcArrow = ({ size = 16, color = C.ink, w = 2 }: P) => (
  <S size={size}><Path d="M5 12h14M13 6l6 6-6 6" {...line(color, w)} /></S>
);
export const IcPen = ({ size = 20, color = C.ink, w = 1.9 }: P) => (
  <S size={size}><Path d="M4 20l4-1 11-11-3-3L5 16z" {...line(color, w)} /></S>
);
export const IcEraser = ({ size = 20, color = C.ink, w = 1.9 }: P) => (
  <S size={size}><Path d="M8 20h12M5 15l9-9 5 5-8 8H8z" {...line(color, w)} /></S>
);
export const IcUndo = ({ size = 20, color = C.ink, w = 1.9 }: P) => (
  <S size={size}>
    <Path d="M9 7H4V2" {...line(color, w)} />
    <Path d="M4 7a8 8 0 1 1-1 7" {...line(color, w)} />
  </S>
);
export const IcMove = ({ size = 20, color = C.ink, w = 1.9 }: P) => (
  <S size={size}>
    <Path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3" {...line(color, w)} />
  </S>
);
export const IcInvite = ({ size = 20, color = C.ink, w = 2 }: P) => (
  <S size={size}>
    <Circle cx={10} cy={8} r={3.5} {...line(color, w)} />
    <Path d="M3.5 20c.8-3.6 3.4-5.5 6.5-5.5 1.5 0 2.9.4 4 1.2" {...line(color, w)} />
    <Path d="M18 14v6M15 17h6" {...line(color, w)} />
  </S>
);
export const IcCrown = ({ size = 11, color = C.ink }: P) => (
  <S size={size}><Path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z" fill={color} /></S>
);
export const IcInfo = ({ size = 15, color = C.sub2, w = 2 }: P) => (
  <S size={size}>
    <Circle cx={12} cy={12} r={9} {...line(color, w)} />
    <Path d="M12 11v6M12 7.5v.5" {...line(color, w)} />
  </S>
);
export const IcClear = ({ size = 16 }: P) => (
  <S size={size}>
    <Circle cx={12} cy={12} r={10} fill={C.sub3} />
    <Path d="M8.5 8.5l7 7M15.5 8.5l-7 7" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" />
  </S>
);

// 하단 탭 아이콘
export const TabHome = ({ color }: { color: string }) => (
  <S><Path d="M4 10.5 12 4l8 6.5V20h-5v-6H9v6H4z" {...line(color, 1.9)} /></S>
);
export const TabCalendar = ({ color }: { color: string }) => (
  <S>
    <Rect x={3.5} y={5} width={17} height={15.5} rx={2} {...line(color, 1.9)} />
    <Path d="M3.5 10h17M8 3v4M16 3v4" {...line(color, 1.9)} />
  </S>
);
export const TabGallery = ({ color }: { color: string }) => (
  <S>
    {[
      [3.5, 3.5],
      [13.5, 3.5],
      [3.5, 13.5],
      [13.5, 13.5],
    ].map(([x, y]) => (
      <Rect key={`${x}${y}`} x={x} y={y} width={7} height={7} rx={1.5} {...line(color, 1.9)} />
    ))}
  </S>
);
export const TabCrew = ({ color }: { color: string }) => (
  <S>
    <Circle cx={9} cy={8} r={3.5} {...line(color, 1.9)} />
    <Path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5" {...line(color, 1.9)} />
    <Path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 14.8c1.6.8 2.6 2.6 3 5.2" {...line(color, 1.9)} />
  </S>
);
