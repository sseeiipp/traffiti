/**
 * 환경 변수 한곳 정리. main.ts가 가장 먼저 불러서 배포 환경에서 빠진 값이 있으면 바로 멈춘다.
 * 개발에서는 로컬 Postgres(5433)와 개발용 비밀키로 돈다.
 */
const prod = process.env.NODE_ENV === 'production';

function need(name: string, dev: string): string {
  const v = process.env[name];
  if (v) return v;
  if (prod) throw new Error(`환경 변수 ${name}가 필요해요(NODE_ENV=production).`);
  return dev;
}

export const config = {
  prod,
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: need('DATABASE_URL', 'postgres://crew:crew@localhost:5433/crew'),
  // Supabase·Neon처럼 TLS가 필요한 관리형 DB면 DATABASE_SSL=true
  databaseSsl: process.env.DATABASE_SSL === 'true',
  jwtSecret: need('JWT_SECRET', 'dev-only-secret-change-me'),
  // 쉼표로 여러 개. 비우면 모두 허용(앱은 브라우저가 아니라 CORS와 무관)
  corsOrigins: (process.env.CORS_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean),
  // 제공자 토큰 검증을 붙이기 전까지의 데모 소셜 로그인. 배포에서는 기본으로 꺼진다
  socialLoginDemo: process.env.SOCIAL_LOGIN_DEMO ? process.env.SOCIAL_LOGIN_DEMO === 'true' : !prod,
  // 소셜 제공자가 돌려보낼 이 서버의 바깥 주소. Railway는 RAILWAY_PUBLIC_DOMAIN을 넣어 준다
  publicUrl: (
    process.env.PUBLIC_URL ??
    (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : `http://localhost:${process.env.PORT ?? 3000}`)
  ).replace(/\/$/, ''),
  // 비밀번호 재설정·이메일 인증 메일. 키가 없으면 링크를 서버 로그에만 남긴다
  mail: {
    resendKey: process.env.RESEND_API_KEY ?? '',
    from: process.env.MAIL_FROM ?? 'Travity <onboarding@resend.dev>',
  },
  // 키가 있는 제공자만 실제 로그인을 연다. 없으면 앱이 데모 로그인으로 넘어간다
  oauth: {
    kakao: { id: process.env.KAKAO_REST_API_KEY ?? '', secret: process.env.KAKAO_CLIENT_SECRET ?? '' },
    naver: { id: process.env.NAVER_CLIENT_ID ?? '', secret: process.env.NAVER_CLIENT_SECRET ?? '' },
    google: { id: process.env.GOOGLE_CLIENT_ID ?? '', secret: process.env.GOOGLE_CLIENT_SECRET ?? '' },
  },
};
