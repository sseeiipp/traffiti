import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { config } from '../config.js';

export interface Place {
  name: string;
  address: string;
  lat: number;
  lng: number;
}

/** 카카오 로컬 키워드 검색(장소명·역 이름에 강하다). KAKAO_REST_API_KEY가 있어야 한다 */
async function kakao(q: string, kind: 'keyword' | 'address'): Promise<Place[]> {
  if (!config.oauth.kakao.id) return [];
  const r = await fetch(`https://dapi.kakao.com/v2/local/search/${kind}.json?size=6&query=${encodeURIComponent(q)}`, {
    headers: { authorization: `KakaoAK ${config.oauth.kakao.id}` },
    signal: AbortSignal.timeout(5_000),
  });
  if (!r.ok) return [];
  const j = (await r.json()) as { documents?: { place_name?: string; address_name: string; road_address_name?: string; x: string; y: string }[] };
  return (j.documents ?? []).map((d) => ({
    name: d.place_name || d.address_name,
    address: d.road_address_name || d.address_name,
    lat: Number(d.y),
    lng: Number(d.x),
  }));
}

/** 키가 없거나 결과가 없을 때: OpenStreetMap Nominatim(한국만) */
async function osm(q: string): Promise<Place[]> {
  const r = await fetch(
    `https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=kr&accept-language=ko&limit=6&q=${encodeURIComponent(q)}`,
    { headers: { 'user-agent': 'travity/1.0 (place search)' }, signal: AbortSignal.timeout(6_000) },
  );
  if (!r.ok) return [];
  const j = (await r.json()) as { name?: string; display_name: string; lat: string; lon: string }[];
  return j.map((d) => ({
    name: d.name || d.display_name.split(',')[0],
    address: d.display_name.split(',').slice(0, 4).reverse().join(' ').trim(),
    lat: Number(d.lat),
    lng: Number(d.lon),
  }));
}

/** '어디서 달릴까요' 검색. 휴대폰의 지오코더는 한국 장소 이름을 잘 못 찾아서 서버가 대신 찾는다 */
@ApiTags('places')
@ApiBearerAuth()
@Controller('places')
export class PlacesController {
  @Get()
  async search(@Query('q') raw: string): Promise<Place[]> {
    const q = (raw ?? '').trim().slice(0, 60);
    if (!q) return [];
    const tries: (() => Promise<Place[]>)[] = [() => kakao(q, 'keyword'), () => kakao(q, 'address'), () => osm(q)];
    for (const t of tries) {
      const found = await t().catch(() => []);
      if (found.length) return found.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
    }
    return [];
  }
}
