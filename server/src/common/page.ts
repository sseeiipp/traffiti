import type { Response } from 'express';

export const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** 안드로이드 브라우저(삼성 인터넷 등)가 travity://를 무시할 때를 대비한 intent:// 주소 */
export function androidIntent(appUrl: string) {
  const m = /^travity:\/\/(.*)$/.exec(appUrl);
  return m ? `intent://${m[1].replace(/#/g, '%23')}#Intent;scheme=travity;package=com.travity.app;end` : appUrl;
}

/**
 * 공유·메일 링크가 여는 웹 페이지. 앱이 깔려 있으면 앱 열기 버튼으로 넘어가고, 아니면 내용을 웹에서 보여 준다.
 * body는 이미 이스케이프한 HTML이다.
 */
export function appPage(
  res: Response,
  p: { title: string; heading: string; text?: string; body?: string; appUrl?: string; button?: string; image?: string; status?: number },
) {
  const og = `<meta property="og:title" content="${esc(p.heading)}"><meta property="og:description" content="${esc(p.text ?? 'Travity · 달리면서 그리는 크루 러닝')}">${
    p.image ? `<meta property="og:image" content="${esc(p.image)}">` : ''
  }`;
  const open = p.appUrl
    ? `<a class="btn" id="go" href="${esc(p.appUrl)}">${esc(p.button ?? 'Travity 앱에서 열기')}</a>
<script>var a=document.getElementById('go');if(/Android/i.test(navigator.userAgent))a.href=${JSON.stringify(androidIntent(p.appUrl)).replace(/</g, '\\u003c')};</script>`
    : '';
  res
    .status(p.status ?? 200)
    .type('html')
    .set('cache-control', 'no-store')
    .send(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(p.title)}</title>${og}
<style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px 16px;font-family:system-ui,-apple-system,sans-serif;background:#f5f5f4;color:#111}
.card{width:100%;max-width:420px;background:#fff;border-radius:24px;padding:28px 24px;display:flex;flex-direction:column;gap:16px;align-items:center;text-align:center}
.brand{font-weight:800;font-size:15px;color:#555}h1{font-size:22px;margin:0}p{margin:0;color:#555;font-size:15px;line-height:1.6}
.btn{display:block;width:100%;padding:16px;border-radius:999px;background:#A3E635;color:#111;font-weight:700;font-size:17px;text-decoration:none;border:0;cursor:pointer}
.art{width:100%;aspect-ratio:1;border-radius:18px;background:#111;display:flex;align-items:center;justify-content:center;overflow:hidden}.art svg{width:86%;height:86%}
.code{font-size:28px;font-weight:800;letter-spacing:4px;padding:12px 20px;border-radius:14px;background:#f5f5f4}
input{width:100%;padding:14px;border-radius:12px;border:1px solid #ddd;font-size:16px}.muted{font-size:13px;color:#999}</style></head>
<body><div class="card"><div class="brand">Travity</div><h1>${esc(p.heading)}</h1>${p.text ? `<p>${esc(p.text)}</p>` : ''}${p.body ?? ''}${open}</div></body></html>`);
}
