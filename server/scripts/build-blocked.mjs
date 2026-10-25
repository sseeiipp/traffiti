// 걸어서 다니면 안 되는 길(자동차 전용·고속도로·보행 금지·보도 없는 큰 길)을 OpenStreetMap(Overpass)에서 받아
// data/blocked.json.gz로 만든다. 지도에 빨간 실선으로 그려 안전하지 않은 곳을 알려 준다.
//   node scripts/build-blocked.mjs
// 형식: [[위도×1e5, 경도×1e5, 위도, 경도, ...], ...] (선 하나에 좌표를 이어 붙인 정수 배열)
import { mkdirSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

import { REGIONS } from './regions.mjs';

// build-roads.mjs와 같은 범위
const q = `[out:json][timeout:300];
(
${REGIONS.map(({ bbox }) => {
  const B = bbox.join(',');
  return `  way["highway"~"^(motorway|motorway_link|trunk|trunk_link)$"](${B});
  way["motorroad"="yes"](${B});
  way["highway"]["foot"="no"](${B});
  way["highway"~"^(primary|primary_link|secondary|secondary_link)$"]["sidewalk"~"^(no|none)$"](${B});`;
}).join('\n')}
);
out geom qt;`;

const res = await fetch('https://overpass-api.de/api/interpreter', {
  method: 'POST',
  headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'travity/1.0 (unsafe roads overlay)' },
  body: 'data=' + encodeURIComponent(q),
});
if (!res.ok) throw new Error(`Overpass ${res.status}: ${(await res.text()).slice(0, 300)}`);
const { elements } = await res.json();
const lines = [];
const kinds = {};
for (const e of elements) {
  if (e.type !== 'way' || !e.geometry || e.geometry.length < 2) continue;
  // 지하 차도·터널은 지도 위 길과 겹쳐 보여 헷갈리므로 뺀다
  if (e.tags?.tunnel === 'yes' || e.tags?.layer?.startsWith('-')) continue;
  const flat = [];
  for (const p of e.geometry) flat.push(Math.round(p.lat * 1e5), Math.round(p.lon * 1e5));
  lines.push(flat);
  kinds[e.tags?.highway ?? '?'] = (kinds[e.tags?.highway ?? '?'] ?? 0) + 1;
}
mkdirSync(new URL('../data/', import.meta.url), { recursive: true });
const gz = gzipSync(Buffer.from(JSON.stringify(lines)), { level: 9 });
writeFileSync(new URL('../data/blocked.json.gz', import.meta.url), gz);
console.log(`lines ${lines.length}, ${(gz.length / 1024).toFixed(0)} KB`, kinds);
