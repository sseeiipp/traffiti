// Docker 없이 쓰는 로컬 Postgres. docker-compose와 같은 계정·포트(5433)로 뜬다.
// 사용법: npm run db   (Ctrl+C로 종료)
//
// Windows의 initdb는 영문이 아닌 경로(예: 바탕화면\부지런)에서 실패하므로
// embedded-postgres 패키지의 바이너리를 사용자 폴더 아래 영문 경로로 복사해서 쓴다.
import { spawn, spawnSync } from 'node:child_process';
import pg from 'pg';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(os.homedir(), '.running-crew');
const bin = path.join(root, 'pg', 'bin');
const data = process.env.PGDATA_DIR ?? path.join(root, 'pgdata');
const exe = (n) => path.join(bin, process.platform === 'win32' ? `${n}.exe` : n);

if (!fs.existsSync(exe('postgres'))) {
  const name = `${process.platform === 'win32' ? 'windows' : process.platform}-${process.arch}`;
  const pkg = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'node_modules', '@embedded-postgres', name);
  console.log('copying postgres binaries to', path.join(root, 'pg'));
  fs.cpSync(path.join(pkg, 'native'), path.join(root, 'pg'), { recursive: true });
}

const env = { ...process.env, LC_ALL: 'C', LANG: 'C', PGPASSWORD: 'crew' };
if (!fs.existsSync(path.join(data, 'PG_VERSION'))) {
  const pw = path.join(root, 'pw.txt');
  fs.writeFileSync(pw, 'crew');
  const r = spawnSync(exe('initdb'), ['-D', data, '-U', 'crew', `--pwfile=${pw}`, '--auth=md5', '--locale=C', '--encoding=UTF8'], {
    env,
    stdio: 'inherit',
  });
  fs.rmSync(pw);
  if (r.status !== 0) process.exit(r.status ?? 1);
}

const server = spawn(exe('postgres'), ['-D', data, '-p', '5433', '-c', 'listen_addresses=localhost'], { env, stdio: 'inherit' });

// 준비되면 crew 데이터베이스를 만든다(이미 있으면 넘어감)
// (패키지에는 psql·createdb가 없어서 pg 드라이버로 확인한다)
let admin;
for (let i = 0; i < 60; i++) {
  await new Promise((r) => setTimeout(r, 500));
  admin = new pg.Client({ host: 'localhost', port: 5433, user: 'crew', password: 'crew', database: 'postgres' });
  try {
    await admin.connect();
    break;
  } catch {
    admin = null;
  }
}
if (!admin) throw new Error('postgres did not start');
const exists = await admin.query(`SELECT 1 FROM pg_database WHERE datname = 'crew'`);
if (!exists.rowCount) await admin.query('CREATE DATABASE crew');
await admin.end();
console.log(`postgres ready on localhost:5433 (data: ${data})`);

const stop = () => {
  server.kill('SIGINT');
  setTimeout(() => process.exit(0), 1500);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
server.on('exit', (code) => process.exit(code ?? 0));
