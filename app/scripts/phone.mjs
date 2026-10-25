// 휴대폰(Expo Go)으로 시연할 때 쓰는 개발 서버.
// PC에 VMware·VirtualBox·WSL 같은 가상 어댑터가 있으면 Expo가 엉뚱한 IP를 QR에 넣으므로
// Wi-Fi 어댑터의 IP를 찾아 Metro와 API 주소에 같이 쓴다.
//
// 사용법: npm.cmd run phone                 (같은 Wi-Fi, 실제 GPS)
//         npm.cmd run phone -- --sim        (가짜 위치로 빈 구간을 따라 달리기, 실내 시연용)
//         npm.cmd run phone -- --remote     (PC에서 서버를 켜지 않고 배포된 Railway API 사용)
//         npm.cmd run phone -- --tunnel     (Wi-Fi가 기기끼리 막혀 QR이 안 열릴 때: Metro를 Expo 터널로)
//         HOST_IP=192.168.0.10 npm.cmd run phone   (IP 직접 지정)
import { spawn } from 'node:child_process';
import os from 'node:os';

const VIRTUAL = /vmware|virtualbox|vbox|vethernet|wsl|hyper-v|docker|loopback|bluetooth|tailscale|zerotier/i;

function wifiIp() {
  if (process.env.HOST_IP) return process.env.HOST_IP;
  const all = Object.entries(os.networkInterfaces()).flatMap(([name, list]) =>
    (list ?? []).filter((a) => a.family === 'IPv4' && !a.internal).map((a) => ({ name, ip: a.address })),
  );
  const real = all.filter((a) => !VIRTUAL.test(a.name) && !a.ip.startsWith('169.254.') && !a.ip.endsWith('.1'));
  const wifi = real.find((a) => /wi-?fi|wlan|wireless|en0/i.test(a.name));
  return (wifi ?? real[0] ?? all[0])?.ip;
}

const ip = wifiIp();
if (!ip) {
  console.error('Wi-Fi IP를 찾지 못했어요. HOST_IP=<PC IP> npm.cmd run phone 으로 지정해 주세요.');
  process.exit(1);
}
const sim = process.argv.includes('--sim');
const tunnel = process.argv.includes('--tunnel');
// --remote: PC에서 서버를 켜지 않고 배포된 API(Railway)를 쓴다
const api = process.argv.includes('--remote') ? 'https://traffiti-production.up.railway.app' : `http://${ip}:3000`;
const env = {
  ...process.env,
  // 터널이면 앱 번들은 터널 주소로 받고, API는 여전히 같은 Wi-Fi의 PC로 간다
  ...(tunnel ? {} : { REACT_NATIVE_PACKAGER_HOSTNAME: ip }),
  EXPO_PUBLIC_API_URL: api,
  ...(sim ? { EXPO_PUBLIC_SIMULATE_GPS: 'true' } : {}),
};
console.log(`\n  PC IP ${ip} · API ${api} · GPS ${sim ? '시뮬레이션' : '실제'} · ${tunnel ? 'Expo 터널' : '같은 Wi-Fi'}`);
console.log('  휴대폰에서 Expo Go 앱을 열고 아래 QR을 찍으세요(iPhone은 기본 카메라로 찍어도 돼요).');
console.log(`  휴대폰 브라우저에서 http://${ip}:3000/health 가 {"ok":true}면 API 연결은 된 거예요.\n`);
// Windows에서 npx는 .cmd라 셸로 띄운다(인자는 고정 문자열)
const child = spawn(`npx expo start ${tunnel ? '--tunnel' : '--lan'} --go --clear`, { env, stdio: 'inherit', shell: true });
child.on('exit', (code) => process.exit(code ?? 0));
