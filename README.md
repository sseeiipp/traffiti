# 트래비티 (trace + graffiti)

크루원이 각자 달린 GPS 경로가 모여 하나의 그림이 되는 러닝 크루 앱. 디자인 캔버스 49개 화면(소개 3장·약관 전문 포함)을 옮겼다. 넓은 화면(768px 이상)에서는 왼쪽 세로 메뉴·2열·가운데 600px로 바뀐다.

- `app/` — Expo SDK 58 · React Native 0.88 · TypeScript · React Navigation · TanStack Query · Zustand (웹으로도 실행)
- `server/` — NestJS 12 · PostgreSQL · JWT(access + refresh) · Swagger(`/docs`) · 매일 04:00(KST) 랭킹 스냅샷

## 실행

터미널 3개:

```bash
# 1) DB — Docker가 되면
docker compose up -d
# Docker 없이(로컬 Postgres, 포트 5433)
cd server && npm run db

# 2) API (http://localhost:3000, 문서 /docs)
cd server && npm run seed   # 처음 한 번: 데모 데이터
cd server && npm run start:dev

# 3) 앱
cd app && npx expo start --web     # 브라우저
cd app && npx expo start           # 휴대폰 Expo Go (같은 Wi-Fi)
```

데모 계정: `doyun@example.com` / `running123` (seed.ts의 로컬 테스트 값)

### 휴대폰(Expo Go)으로 시연

```bash
cd app && npm.cmd run phone          # 실제 GPS
cd app && npm.cmd run phone -- --sim # 실내 시연: 빈 구간을 따라 가짜 위치로 달리기
cd app && npm.cmd run phone -- --tunnel # QR을 찍어도 안 열릴 때(Wi-Fi가 기기끼리 막힘)
```

- PC의 Wi-Fi IP를 찾아(VMware·WSL 같은 가상 어댑터 제외) QR과 API 주소(`http://<IP>:3000`)에 같이 넣는다. 직접 지정은 `HOST_IP=...`.
- PowerShell에서 `npm`이 실행 정책 오류를 내면 `npm.cmd`를 쓴다.
- 휴대폰과 PC는 같은 Wi-Fi여야 한다. 행사장 Wi-Fi가 기기끼리 막혀 있으면 PC를 휴대폰 핫스팟에 연결하고 다시 실행한다(IP가 바뀜).
- 휴대폰 브라우저에서 `http://<IP>:3000/health`가 `{"ok":true}`면 연결은 된 것이다.

## 배포 준비 (아직 배포하지 않음)

준비된 것:

- `server/Dockerfile` — Node 24 alpine 멀티 스테이지. `/health` 헬스체크, `NODE_ENV=production`.
- `server/.env.example` — 배포 환경 변수. `NODE_ENV=production`이면 `DATABASE_URL`·`JWT_SECRET`이 없을 때 서버가 바로 멈춘다(`server/src/config.ts`). 관리형 DB는 `DATABASE_SSL=true`. 스키마는 부팅 때 자동 적용.
- `app/eas.json` — `preview`(내부 배포용 APK) · `production`(스토어용, 빌드 번호 자동 증가). 프로필별 `EXPO_PUBLIC_API_URL`.
- `app/app.json` — 번들 ID `com.travity.app`(iOS·Android).
- `.github/workflows/ci.yml` — push·PR마다 서버 타입 검사·빌드·Docker 빌드, 앱 타입 검사·Android 번들 export.

배포할 때 순서:

1. **DB** — Supabase 프로젝트 생성 → Session pooler 연결 문자열을 `DATABASE_URL`로.
2. **API** — Railway(또는 Render)에서 이 저장소 연결, Root Directory `server`, Dockerfile로 빌드. 환경 변수는 `.env.example` 참고(`JWT_SECRET`은 `openssl rand -base64 48`). 발급된 https 주소에서 `/health` 확인. 필요하면 `npm run seed`는 로컬에서 `DATABASE_URL`을 바꿔 한 번만.
3. **앱** — `app/eas.json`의 `REPLACE-ME` 주소를 2의 https 주소로 바꾼 뒤
   ```bash
   cd app && npx eas-cli@latest login
   cd app && npx eas-cli@latest init          # projectId가 app.json에 들어간다
   cd app && npx eas-cli@latest build -p android --profile preview
   ```
   스토어 제출은 `--profile production` 빌드 후 `eas submit`.

출시 전에 남은 일:

- 소셜 로그인 실제 연동(카카오·네이버·Google 콘솔 키, 서버에서 제공자 토큰 검증). 그전까지 배포 서버에서는 이메일 가입만 동작. iOS 스토어에 소셜 로그인을 넣으면 Apple 로그인도 필요.
- 이메일 인증·비밀번호 재설정 메일 발송(Resend 등) — 지금은 서버 로그에만 찍힌다.
- 카카오맵 SDK·경로 생성(OSRM 맵 매칭) 연결.
- 앱 아이콘·스플래시는 아직 Expo 기본 이미지.
- EAS Update(OTA)를 쓰려면 `npx expo install expo-updates` 후 `eas update:configure`.

## 시연 모드

- 웹에서는 GPS 대신 **챌린지의 비어 있는 구간을 따라 움직이는 가짜 위치**로 달린다(상태 표시에 'GPS 시뮬레이션'). 휴대폰에서도 쓰려면 `EXPO_PUBLIC_SIMULATE_GPS=true`.
- 소셜 로그인(카카오·네이버·Google)은 개발자 콘솔 등록 전이라 **기기 식별자로 가입하는 데모 모드**다. 배포(`NODE_ENV=production`)에서는 기본으로 막힌다(`SOCIAL_LOGIN_DEMO`).
- 비밀번호 재설정 메일은 발송 연동 전이라 링크 토큰이 서버 로그에 찍히고, 개발 환경에서는 앱이 바로 다음 단계로 넘어간다.

## 서버에서 지키는 규칙 (기획서 · 기술 명세서)

크루 최대 5개 · 대표 크루 1개(대표 크루를 나가면 가장 최근에 달린 크루로) · 크루당 진행 중 챌린지 1개(DB 부분 유니크 인덱스) · 초대 코드 6자리/7일 만료/새로 만들면 이전 코드 폐기/시도 횟수 제한 · 러닝 하나는 시작한 챌린지 하나에만 · 30초 넘는 GPS 공백은 거리·진행률에서 제외(직선으로 잇지 않음) · 정확도 50m 초과·시속 30km 초과 점 제외 · 진행률은 목표 경로 20m 구간 중 기록이 30m 안에 들어온 비율, 95% 이상이면 완성 · XP 1km +10 / 완성 +200 / 모두 참여 +100(출처별 중복 지급 방지) · 친구 챌린지는 랭킹·레벨 제외, 크루로 만들면 작품·XP 이전 · 랭킹 동점은 같은 순위 후 건너뛰기 · 티어 98/92/85% · 상세 GPS는 본인만, 작품에는 구간 번호만 저장 · 계정 삭제 시 러닝·GPS 삭제, 작품 구간은 '나간 크루원'으로 유지 · 권한 검사는 모두 서버에서.

## 아직 정하지 않은 것(기획서 미정 항목)과 지금의 처리

| 항목 | 지금 |
| --- | --- |
| 지도 SDK · 경로 API | 카카오맵으로 결정됐지만 아직 연결 전(앱 키 필요). 지금은 디자인의 단순화된 지도 위에 실제 좌표를 그리고, 경로 제안은 그림 선을 출발 지점 기준으로 그대로 옮긴 것 |
| 그림과 닮은 정도 계산 | 계산하지 않고 '—'로 표시 |
| 사진 업로드 · 검수 | 사진 유무만 저장, 디자인의 일러스트로 표시. 크루 신고는 서버에 저장(이름·소개는 금칙어 자동 표시) — 운영자 검토 화면은 없음 |
| 앱 링크 | `example.com` / `[앱 링크]` 자리표시자 |
| 이미지 저장(공유) | 프로토타입처럼 문구만 바뀜. 링크 복사·다른 앱으로 공유는 동작 |
| 백그라운드 위치 | 앱 사용 중 위치만. 백그라운드 추적은 개발 빌드 + 네이티브 설정 필요 |
| 약관 전문 | 시안용 문구(03-1-1). 출시 전 법무 확인 |
