// 서버가 뜰 때 실행하는 스키마. 모든 문장은 여러 번 실행해도 안전해야 한다.
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  display_name TEXT NOT NULL,
  profile_image_url TEXT,
  email TEXT UNIQUE,
  auth_provider TEXT NOT NULL DEFAULT 'email',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- 비밀번호와 외부 계정 식별자는 일반 사용자 정보와 분리
CREATE TABLE IF NOT EXISTS user_auth_accounts (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_subject TEXT NOT NULL,
  password_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_subject)
);

CREATE TABLE IF NOT EXISTS user_settings (
  user_id INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  region TEXT NOT NULL DEFAULT '성동구 성수동',
  region_auto BOOLEAN NOT NULL DEFAULT true,
  distance_unit TEXT NOT NULL DEFAULT 'km',
  notify_new_challenge BOOLEAN NOT NULL DEFAULT true,
  notify_segment BOOLEAN NOT NULL DEFAULT false,
  notify_artwork BOOLEAN NOT NULL DEFAULT true,
  gps_visibility TEXT NOT NULL DEFAULT 'me',
  artwork_visibility TEXT NOT NULL DEFAULT 'crew',
  hide_start_on_share BOOLEAN NOT NULL DEFAULT true,
  terms_agreed_at TIMESTAMPTZ,
  marketing_agreed BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS crews (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  intro TEXT NOT NULL DEFAULT '',
  has_photo BOOLEAN NOT NULL DEFAULT false,
  color TEXT NOT NULL DEFAULT '#A3E635',
  home_region TEXT NOT NULL DEFAULT '성동구 성수동',
  join_policy TEXT NOT NULL DEFAULT 'code',
  challenge_permission TEXT NOT NULL DEFAULT 'all',
  artwork_visibility TEXT NOT NULL DEFAULT 'crew',
  discoverable BOOLEAN NOT NULL DEFAULT false,
  created_by INT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS crew_members (
  id SERIAL PRIMARY KEY,
  crew_id INT NOT NULL REFERENCES crews(id) ON DELETE CASCADE,
  user_id INT REFERENCES users(id) ON DELETE SET NULL,
  role TEXT NOT NULL DEFAULT 'member',
  record_color TEXT NOT NULL,
  notify BOOLEAN NOT NULL DEFAULT true,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  left_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS crew_members_active ON crew_members (crew_id, user_id) WHERE left_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS crew_members_color ON crew_members (crew_id, record_color) WHERE left_at IS NULL;

CREATE TABLE IF NOT EXISTS crew_join_requests (
  id SERIAL PRIMARY KEY,
  crew_id INT NOT NULL REFERENCES crews(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_crew_preferences (
  user_id INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  primary_crew_id INT REFERENCES crews(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crew_invites (
  id SERIAL PRIMARY KEY,
  crew_id INT NOT NULL REFERENCES crews(id) ON DELETE CASCADE,
  invite_code CHAR(6) NOT NULL,
  created_by INT REFERENCES users(id),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS crew_invites_live ON crew_invites (invite_code) WHERE revoked_at IS NULL;

-- 크루 챌린지와 친구 챌린지를 함께 담는다. 친구 챌린지는 crew_id가 없고 friend_code가 있다.
CREATE TABLE IF NOT EXISTS challenges (
  id SERIAL PRIMARY KEY,
  crew_id INT REFERENCES crews(id) ON DELETE CASCADE,
  friend_code CHAR(6),
  created_by INT REFERENCES users(id),
  shape_key TEXT NOT NULL,
  title TEXT NOT NULL,
  category TEXT,
  drawing_mode TEXT NOT NULL DEFAULT 'library',
  status TEXT NOT NULL DEFAULT 'active',
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'crew',
  gps_visibility TEXT NOT NULL DEFAULT 'me',
  area_label TEXT NOT NULL DEFAULT '성수동 일대',
  start_label TEXT NOT NULL DEFAULT '성수역 3번 출구',
  target_distance_m INT NOT NULL,
  difficulty TEXT NOT NULL,
  route_points JSONB NOT NULL,
  progress REAL NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ
);
-- 크루당 진행 중 챌린지 1개
CREATE UNIQUE INDEX IF NOT EXISTS challenges_one_active ON challenges (crew_id) WHERE status = 'active' AND crew_id IS NOT NULL;
-- 친구 챌린지는 오늘 24시까지. 시간이 끝나면 내일 24시까지 한 번만 연장할 수 있다
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS extended_at TIMESTAMPTZ;
CREATE UNIQUE INDEX IF NOT EXISTS challenges_friend_code ON challenges (friend_code) WHERE friend_code IS NOT NULL AND status = 'active';

CREATE TABLE IF NOT EXISTS challenge_participations (
  challenge_id INT NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  color TEXT NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (challenge_id, user_id)
);

CREATE TABLE IF NOT EXISTS runs (
  id SERIAL PRIMARY KEY,
  client_id TEXT UNIQUE,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  challenge_id INT REFERENCES challenges(id) ON DELETE SET NULL,
  crew_id INT REFERENCES crews(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'recording',
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  distance_m REAL NOT NULL DEFAULT 0,
  duration_s INT NOT NULL DEFAULT 0,
  gap_count INT NOT NULL DEFAULT 0,
  gap_seconds INT NOT NULL DEFAULT 0,
  segment_label TEXT,
  progress_before REAL,
  progress_after REAL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS run_points (
  run_id INT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  seq INT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL,
  accuracy_m REAL,
  PRIMARY KEY (run_id, seq)
);

-- 작품에 남는 기여 구간. 원본 GPS가 아니라 목표 경로의 구간 번호만 저장한다.
CREATE TABLE IF NOT EXISTS challenge_coverage (
  challenge_id INT NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  seg_index INT NOT NULL,
  user_id INT REFERENCES users(id) ON DELETE SET NULL,
  run_id INT REFERENCES runs(id) ON DELETE SET NULL,
  color TEXT NOT NULL,
  covered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (challenge_id, seg_index)
);

CREATE TABLE IF NOT EXISTS crew_xp_transactions (
  id SERIAL PRIMARY KEY,
  crew_id INT REFERENCES crews(id) ON DELETE CASCADE,
  challenge_id INT REFERENCES challenges(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  xp_amount INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_type, source_id)
);

CREATE TABLE IF NOT EXISTS crew_ranking_snapshots (
  id SERIAL PRIMARY KEY,
  crew_id INT NOT NULL REFERENCES crews(id) ON DELETE CASCADE,
  ranking_type TEXT NOT NULL,
  period_key TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'all',
  score REAL NOT NULL,
  rank INT NOT NULL,
  tier TEXT,
  detail TEXT,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crew_ranking_lookup ON crew_ranking_snapshots (ranking_type, period_key, category, calculated_at DESC);

-- 다른 크루 신고. 신고한 사람은 크루에 알려지지 않는다.
-- 사진은 운영팀이 직접 검토, 이름·소개는 금칙어 자동 검사 후 필요하면 운영팀이 본다.
CREATE TABLE IF NOT EXISTS crew_reports (
  id SERIAL PRIMARY KEY,
  crew_id INT NOT NULL REFERENCES crews(id) ON DELETE CASCADE,
  reporter_id INT REFERENCES users(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  auto_flagged BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 유저 신고. 이름·사진은 운영팀이 직접, 나머지는 자동 검사 후 필요하면 운영팀이 본다.
CREATE TABLE IF NOT EXISTS user_reports (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reporter_id INT REFERENCES users(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  auto_flagged BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- 크루가 이름으로 찾은 사람에게 보낸 초대(crew_join_requests.status = 'invited')는 한 사람당 하나
CREATE UNIQUE INDEX IF NOT EXISTS crew_invited_once ON crew_join_requests (crew_id, user_id) WHERE status = 'invited';

-- 프로필·크루 사진. 작게 줄인 JPEG를 DB에 바로 담고 /images/:id로 내보낸다
CREATE TABLE IF NOT EXISTS images (
  id SERIAL PRIMARY KEY,
  owner_id INT REFERENCES users(id) ON DELETE SET NULL,
  mime TEXT NOT NULL,
  data BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE crews ADD COLUMN IF NOT EXISTS photo_url TEXT;
-- 업로드 연결 전의 '사진 있음' 표시(예시 그림)는 실제 사진이 없으니 지운다
UPDATE crews SET has_photo = false WHERE has_photo AND photo_url IS NULL;
UPDATE users SET profile_image_url = NULL WHERE profile_image_url = 'placeholder';
`;
