import { createElement, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Platform, View } from 'react-native';
import { WebView as RNWebView, type WebViewMessageEvent, type WebViewProps } from 'react-native-webview';
import { C } from '../theme';
import type { LatLng, RouteArtProps } from './MapArt';

/**
 * 카카오맵 위에 경로를 그린다. 카카오 JavaScript 키(EXPO_PUBLIC_KAKAO_JS_KEY)가 없거나
 * SDK를 못 불러오면(도메인 미등록 등) fallback(단순화한 SVG 지도)을 그대로 보여준다.
 *
 * 카카오 콘솔의 JavaScript SDK 도메인 검사가 WebView·웹에서 통과하지 않아 지금은 Referer를 보내지 않는다(no-referrer).
 * 출시 전에는 도메인 등록이 먹는지 다시 확인하고 이 메타 태그를 빼는 편이 안전하다.
 */
export const KAKAO_JS_KEY = process.env.EXPO_PUBLIC_KAKAO_JS_KEY ?? '';
const BASE_URL = 'https://travity.app';

type WebViewHandle = { injectJavaScript: (js: string) => void };
// WebView 클래스 타입이 React 19 타입과 맞지 않아 props만 지정해 쓴다
const WebView = RNWebView as unknown as (p: WebViewProps & { ref?: React.Ref<WebViewHandle> }) => ReactNode;

const html = (key: string) => `<!doctype html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<meta name="referrer" content="no-referrer">
<style>html,body,#m{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:${C.map.land}}</style>
<script src="https://dapi.kakao.com/v2/maps/sdk.js?appkey=${key}&autoload=false"></script>
</head><body><div id="m"></div><script>
var map=null,objs=[],pending=null,fitKey=null;
function post(m){try{window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(m)}catch(e){}}
function ll(p){return new kakao.maps.LatLng(p[0],p[1])}
function line(pts,color,w,op,dash){var l=new kakao.maps.Polyline({path:pts.map(ll),strokeWeight:w,strokeColor:color,strokeOpacity:op,strokeStyle:dash?'shortdash':'solid'});l.setMap(map);objs.push(l)}
function dot(p,color,r,halo){var c=document.createElement('div');c.style.cssText='width:'+(2*r)+'px;height:'+(2*r)+'px;border-radius:50%;background:'+color+';border:3px solid #fff;box-sizing:border-box;'+(halo?'box-shadow:0 0 0 10px '+color+'2E;':'');var o=new kakao.maps.CustomOverlay({position:ll(p),content:c,xAnchor:0.5,yAnchor:0.5,zIndex:3});o.setMap(map);objs.push(o)}
function update(d){
  if(!map){pending=d;return}
  objs.forEach(function(o){o.setMap(null)});objs=[];
  d.lines.forEach(function(l){if(l.pts.length>1)line(l.pts,l.color,l.w,l.op,l.dash)});
  if(d.start)dot(d.start,'${C.ink}',7,false);
  if(d.me)dot(d.me.pos,d.me.color,8,true);
  if(d.fitKey!==fitKey&&d.bounds.length){
    fitKey=d.fitKey;map.relayout();
    var one=d.bounds.every(function(p){return p[0]===d.bounds[0][0]&&p[1]===d.bounds[0][1]});
    if(one){map.setLevel(4);map.setCenter(ll(d.bounds[0]));map.panBy(0,(d.insetBottom-d.insetTop)/2)}
    else{var b=new kakao.maps.LatLngBounds();d.bounds.forEach(function(p){b.extend(ll(p))});
      map.setBounds(b,d.pad+d.insetTop,d.pad,d.pad+d.insetBottom,d.pad)}
  }
}
window.update=update;
if(typeof kakao==='undefined'){post('fail')}else{
  kakao.maps.load(function(){
    map=new kakao.maps.Map(document.getElementById('m'),{center:new kakao.maps.LatLng(37.5446,127.0559),level:4,draggable:false,scrollwheel:false,disableDoubleClickZoom:true});
    post('ready');if(pending)update(pending);
  });
}
</script></body></html>`;

type Line = { pts: LatLng[]; color: string; w: number; op: number; dash: boolean };

/** RouteArt와 같은 규칙으로 구간을 색별로 묶는다 */
function build(p: RouteArtProps) {
  const { route, segments, mode = 'progress', stroke = 6, trail, me, showStart, hideRemaining, pad = 24, insetTop = 0, insetBottom = 0 } = p;
  const lines: Line[] = [];
  if (p.target && p.target.length > 1) lines.push({ pts: p.target, color: C.target, w: 3, op: 1, dash: true });
  if (mode === 'target') lines.push({ pts: route, color: C.target, w: 3, op: 1, dash: true });
  else if (mode === 'route') lines.push({ pts: route, color: C.ink, w: stroke - 1, op: 1, dash: false });
  else {
    const segs = segments ?? route.slice(1).map(() => null);
    segs.forEach((c, i) => {
      if (!c && hideRemaining) return;
      const last = lines[lines.length - 1];
      if (last && segs[i - 1] === c && i > 0) last.pts.push(route[i + 1]);
      else if (c) lines.push({ pts: [route[i], route[i + 1]], color: c, w: stroke, op: mode === 'faded' ? 0.35 : 1, dash: false });
      else lines.push({ pts: [route[i], route[i + 1]], color: C.ink, w: 2.5, op: 0.45, dash: true });
    });
  }
  if (trail && trail.points.length > 1) lines.push({ pts: trail.points, color: trail.color, w: stroke + 1, op: 1, dash: false });
  const bounds = [...route, ...(trail?.points ?? []), ...(p.target ?? [])];
  // 시트 높이가 바뀌어도 다시 맞춘다
  const fitKey = `${route.length}:${route[0]?.join()}:${route[route.length - 1]?.join()}:${insetTop}:${insetBottom}`;
  return { lines, start: showStart ? route[0] ?? null : null, me: me ?? null, bounds, fitKey, pad, insetTop, insetBottom };
}

export function KakaoRouteMap({ fallback, ...p }: RouteArtProps & { fallback: ReactNode }) {
  const [state, setState] = useState<'loading' | 'ready' | 'fail'>('loading');
  const data = useMemo(() => build(p), [p.route, p.segments, p.mode, p.stroke, p.trail, p.me, p.showStart, p.hideRemaining, p.pad, p.insetTop, p.insetBottom, p.target]);
  const page = useMemo(() => html(KAKAO_JS_KEY), []);
  const web = useRef<WebViewHandle>(null);
  const frame = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    if (state !== 'ready') return;
    const json = JSON.stringify(data);
    if (Platform.OS === 'web') (frame.current?.contentWindow as any)?.update?.(data);
    else web.current?.injectJavaScript(`window.update(${json});true;`);
  }, [data, state]);

  if (state === 'fail') return <>{fallback}</>;
  return (
    <View style={{ width: p.w, height: p.h, backgroundColor: C.map.land }} pointerEvents="none">
      {Platform.OS === 'web' ? (
        createElement('iframe', {
          ref: frame,
          srcDoc: page,
          style: { border: 0, width: '100%', height: '100%' },
          onLoad: () => setState((frame.current?.contentWindow as any)?.kakao ? 'ready' : 'fail'),
        })
      ) : (
        <WebView
          ref={web}
          source={{ html: page, baseUrl: BASE_URL }}
          originWhitelist={['*']}
          scrollEnabled={false}
          style={{ flex: 1, backgroundColor: C.map.land }}
          onMessage={(e: WebViewMessageEvent) => setState(e.nativeEvent.data === 'ready' ? 'ready' : 'fail')}
          onError={() => setState('fail')}
        />
      )}
    </View>
  );
}
