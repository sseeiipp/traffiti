import { Logger } from '@nestjs/common';
import { config } from '../config.js';

const log = new Logger('Mail');

/**
 * Resend(https://resend.com)로 메일을 보낸다. RESEND_API_KEY가 없으면 보내지 않고 서버 로그에만 남긴다.
 * 보내는 주소(MAIL_FROM)는 Resend에서 인증한 도메인이어야 한다. 시험용으로는 onboarding@resend.dev(가입한 본인 주소로만 감).
 */
export async function sendMail(to: string, subject: string, html: string, fallbackLog: string): Promise<boolean> {
  if (!config.mail.resendKey) {
    log.log(`(메일 키 없음) ${to} · ${subject} · ${fallbackLog}`);
    return false;
  }
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${config.mail.resendKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: config.mail.from, to: [to], subject, html }),
    });
    if (!r.ok) {
      log.warn(`메일 발송 실패 ${r.status}: ${(await r.text()).slice(0, 200)}`);
      return false;
    }
    return true;
  } catch (e) {
    log.warn(`메일 발송 실패: ${(e as Error).message}`);
    return false;
  }
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** 메일 본문 공통 틀. 버튼 하나와 안내 문장 */
export function mailHtml(title: string, body: string, button: string, href: string) {
  return `<!doctype html><html lang="ko"><body style="margin:0;padding:32px 16px;background:#f5f5f4;font-family:system-ui,-apple-system,sans-serif;color:#111">
<div style="max-width:440px;margin:0 auto;background:#fff;border-radius:20px;padding:32px 28px">
<div style="font-size:20px;font-weight:800;margin-bottom:4px">Travity</div>
<h1 style="font-size:22px;margin:24px 0 12px">${esc(title)}</h1>
<p style="font-size:15px;line-height:1.6;color:#444;margin:0 0 28px">${body}</p>
<a href="${esc(href)}" style="display:inline-block;padding:14px 28px;border-radius:999px;background:#A3E635;color:#111;font-weight:700;text-decoration:none">${esc(button)}</a>
<p style="font-size:12px;color:#999;margin:28px 0 0;line-height:1.5">버튼이 안 눌리면 아래 주소를 복사해 열어 주세요.<br>${esc(href)}</p>
</div></body></html>`;
}
