import { pathLength, resample } from './geometry.js';
import { fitToRoads } from './routing.js';
import { SHAPES } from './shapes.js';

// 라이브러리 '추천' 그림이 시연 지역(성수역 3번 출구)에서 실제 도로망으로 경로가 되는지 확인한다.
// 경로 제안(challenges.service suggest)과 같은 기준: 닮은 정도 70 이상, 가장 어긋난 조각 40 이상, 길이 1.6배 이하
const START: [number, number] = [37.5446, 127.0559];

describe('추천 그림 도로망 테스트', () => {
  for (const s of SHAPES.filter((x) => x.pick)) {
    it(`${s.label}(${s.key})`, async () => {
      const fit = await fitToRoads(s.path, START, 3000);
      expect(fit.road).not.toBeNull();
      const route = resample(fit.road!, 20);
      expect(fit.similarity!).toBeGreaterThanOrEqual(70);
      expect(fit.worstPart ?? 100).toBeGreaterThanOrEqual(40);
      expect(pathLength(route) / pathLength(fit.shape)).toBeLessThanOrEqual(1.6);
    }, 60_000);
  }
});
