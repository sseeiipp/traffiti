// 경로 제안용 도로망을 받아 둘 지역(남, 서, 북, 동). 그림이 뻗어 나갈 여유까지 넉넉히 잡는다.
// 지역을 더하면 node scripts/build-roads.mjs, node scripts/build-blocked.mjs를 다시 실행한다.
// 이 범위 밖은 공개 경로 서버(OSRM)로 경로를 만든다(정확도가 조금 낮다).
export const REGIONS = [
  { name: '성수·건대·왕십리', bbox: [37.505, 126.995, 37.59, 127.115] },
  { name: '안산 와동·선부동·고잔동', bbox: [37.285, 126.77, 37.37, 126.9] },
];
