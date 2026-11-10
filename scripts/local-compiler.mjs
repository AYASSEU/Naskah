import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  copyFileSync,
} from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { root, localEnv, loadEnv, setMissingEnv } from './lib/local.mjs';
const runtime = resolve(process.env.LOCALAPPDATA ?? '/tmp', 'naskah-runtime'),
  fonts = join(runtime, 'compiler-fonts');
mkdirSync(fonts, { recursive: true });
if (process.platform === 'win32')
  for (const name of ['times.ttf', 'timesbd.ttf', 'timesi.ttf', 'timesbi.ttf']) {
    const source = join(process.env.WINDIR ?? 'C:/Windows', 'Fonts', name);
    if (existsSync(source)) copyFileSync(source, join(fonts, name));
  }
loadEnv();
if (process.env.COMPILER_MODE === 'client') {
  console.log('Compiler fallback browser dipilih secara eksplisit.');
}
setMissingEnv({
  COMPILER_SERVICE_TOKEN: randomBytes(32).toString('base64url'),
  COMPILER_SERVICE_URL: 'http://127.0.0.1:8000',
});
// Reload only this field: process.loadEnvFile does not override existing values.
const match = readFileSync(localEnv, 'utf8').match(/^COMPILER_SERVICE_TOKEN=(.+)$/m);
if (!match || match[1].trim().length < 32) throw new Error('Token compiler lokal tidak valid.');
const envPath = join(runtime, 'compiler.env');
writeFileSync(envPath, `COMPILER_SERVICE_TOKEN=${match[1].trim()}\n`, { mode: 0o600 });
const service = resolve(root, 'compiler-service');
const hash = createHash('sha256');
for (const name of readdirSync(service)
  .filter((name) => !['output', 'node_modules'].includes(name))
  .sort()) {
  if (/\.(mjs|py|json|lua)$|^Dockerfile$|^\.dockerignore$/.test(name))
    hash.update(name).update(readFileSync(join(service, name)));
}
for (const name of readdirSync(fonts).sort())
  hash.update(name).update(readFileSync(join(fonts, name)));
const fingerprint = hash.digest('hex');
function docker(args, capture = false) {
  const r = spawnSync('docker', args, {
    cwd: root,
    windowsHide: true,
    encoding: 'utf8',
    stdio: capture ? 'pipe' : 'inherit',
  });
  if (r.error || r.status !== 0) throw new Error('Docker compiler gagal; periksa keluaran Docker.');
  return r.stdout?.trim();
}
const inspect = spawnSync(
  'docker',
  ['inspect', '--format', '{{index .Config.Labels "naskah.compiler"}}', 'naskah-compiler'],
  { encoding: 'utf8', windowsHide: true },
);
if (inspect.status === 0 && inspect.stdout.trim() === fingerprint) {
  docker(['start', 'naskah-compiler'], true);
} else {
  docker([
    'buildx',
    'build',
    '--load',
    '--build-context',
    `local-fonts=${fonts}`,
    '--build-arg',
    `SOURCE_HASH=${fingerprint}`,
    '-t',
    'naskah-compiler:local',
    service,
  ]);
  if (inspect.status === 0) docker(['rm', '-f', 'naskah-compiler'], true);
  docker(
    [
      'run',
      '-d',
      '--name',
      'naskah-compiler',
      '--label',
      `naskah.compiler=${fingerprint}`,
      '--restart',
      'unless-stopped',
      '-p',
      '127.0.0.1:8000:8000',
      '--env-file',
      envPath,
      '--read-only',
      '--tmpfs',
      '/tmp:rw,nosuid,nodev,size=512m,mode=1777',
      '--cap-drop',
      'ALL',
      '--security-opt',
      'no-new-privileges',
      '--memory',
      '1g',
      '--cpus',
      '2',
      '--pids-limit',
      '128',
      '--health-cmd',
      'node -e "fetch(\'http://127.0.0.1:8000/health\').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"',
      '--health-interval',
      '15s',
      '--health-timeout',
      '5s',
      '--health-retries',
      '3',
      'naskah-compiler:local',
    ],
    true,
  );
}
let healthy = false;
for (let attempt = 0; attempt < 30; attempt++) {
  try {
    const response = await fetch('http://127.0.0.1:8000/health', {
      signal: AbortSignal.timeout(3000),
    });
    if (response.ok) {
      healthy = true;
      break;
    }
  } catch {}
  await new Promise((resolve) => setTimeout(resolve, 500));
}
if (!healthy) throw new Error('Layanan dokumen belum sehat; periksa docker logs naskah-compiler.');
console.log('Parser dan compiler lokal siap pada 127.0.0.1:8000.');
