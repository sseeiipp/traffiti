// 지원 지역의 걸을 수 있는 길을 OpenStreetMap(Overpass)에서 받아 data/roads.bin.gz로 만든다.
// 경로 제안이 이 도로망 위에서 그림 선에 가까운 길을 고른다. 지역을 넓히면 BBOX를 고치고 다시 실행한다.
//   node scripts/build-roads.mjs
// 형식(리틀 엔디언): u32 노드 수 N, u32 간선 수 E, i32 위도×1e6 [N], i32 경도×1e6 [N], u32 (a, b) [E]
import { mkdirSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const BBOX = [37.505, 126.995, 37.59, 127.115]; // 남, 서, 북, 동 (지원 지역 + 그림이 뻗어 나갈 여유)
const HIGHWAY = 'footway|path|pedestrian|living_street|residential|service|unclassified|tertiary|tertiary_link|secondary|secondary_link|primary|primary_link|track|cycleway|steps|corridor';
const q = `[out:json][timeout:180];
way["highway"~"^(${HIGHWAY})$"]["access"!~"^(private|no)$"]["foot"!~"^(no|private)$"](${BBOX.join(',')});
(._;>;);
out skel qt;`;

const res = await fetch('https://overpass-api.de/api/interpreter', {
  method: 'POST',
  headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'travity/1.0 (route suggestions)' },
  body: 'data=' + encodeURIComponent(q),
});
if (!res.ok) throw new Error(`Overpass ${res.status}: ${(await res.text()).slice(0, 300)}`);
const { elements } = await res.json();

const index = new Map();
const lat = [];
const lng = [];
for (const e of elements) {
  if (e.type !== 'node') continue;
  index.set(e.id, lat.length);
  lat.push(Math.round(e.lat * 1e6));
  lng.push(Math.round(e.lon * 1e6));
}
const seen = new Set();
const edges = [];
for (const e of elements) {
  if (e.type !== 'way') continue;
  for (let k = 1; k < e.nodes.length; k++) {
    const a = index.get(e.nodes[k - 1]);
    const b = index.get(e.nodes[k]);
    if (a === undefined || b === undefined || a === b) continue;
    const key = a < b ? `${a},${b}` : `${b},${a}`;
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push(a, b);
  }
}
const N = lat.length;
const E = edges.length / 2;
const buf = Buffer.alloc(8 + N * 8 + E * 8);
buf.writeUInt32LE(N, 0);
buf.writeUInt32LE(E, 4);
let o = 8;
for (const v of lat) (buf.writeInt32LE(v, o), (o += 4));
for (const v of lng) (buf.writeInt32LE(v, o), (o += 4));
for (const v of edges) (buf.writeUInt32LE(v, o), (o += 4));
mkdirSync(new URL('../data/', import.meta.url), { recursive: true });
const gz = gzipSync(buf, { level: 9 });
writeFileSync(new URL('../data/roads.bin.gz', import.meta.url), gz);
console.log(`nodes ${N}, edges ${E}, ${(gz.length / 1024).toFixed(0)} KB`);
