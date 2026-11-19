import { createHash, randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { root, loadEnv, setMissingEnv } from './lib/local.mjs';
import { ensureDocker } from './lib/docker.mjs';
ensureDocker();
loadEnv();
const token = process.env.EVALUATION_SERVICE_TOKEN || randomBytes(32).toString('base64url');
setMissingEnv({
  EVALUATION_SERVICE_TOKEN: token,
  EVALUATION_SERVICE_URL: process.env.EVALUATION_SERVICE_URL || 'http://127.0.0.1:8010',
});
if (!token || token.length < 32) throw new Error('Evaluation service token missing.');
const runtime = resolve(process.env.LOCALAPPDATA ?? '/tmp', 'naskah-runtime');
mkdirSync(runtime, { recursive: true });
const envPath = join(runtime, 'evaluation.env');
writeFileSync(envPath, `EVALUATION_SERVICE_TOKEN=${token}\n`, { mode: 0o600 });
const service = resolve(root, 'evaluation-scripts'),
  hash = createHash('sha256');
function fingerprint(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    if (['.venv', '__pycache__', 'output'].includes(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) fingerprint(path);
    else if (/\.(py|txt)$|Dockerfile|dockerignore/.test(entry.name))
      hash.update(path.slice(service.length)).update(readFileSync(path));
  }
}
fingerprint(service);
const source = hash.digest('hex'),
  containerHash = createHash('sha256').update(source).update(token).digest('hex');
function docker(args, capture = false) {
  const r = spawnSync('docker', args, {
    cwd: root,
    windowsHide: true,
    encoding: 'utf8',
    stdio: capture ? 'pipe' : 'inherit',
  });
  if (r.error || r.status !== 0) throw new Error('Docker evaluation service failed.');
  return r.stdout;
}
const state = spawnSync(
  'docker',
  ['inspect', '--format', '{{index .Config.Labels "naskah.evaluation"}}', 'naskah-evaluation'],
  { encoding: 'utf8', windowsHide: true },
);
if (state.status === 0 && state.stdout.trim() === containerHash)
  docker(['start', 'naskah-evaluation'], true);
else {
  docker([
    'build',
    '--build-arg',
    `SOURCE_HASH=${source}`,
    '-t',
    'naskah-evaluation:local',
    service,
  ]);
  if (state.status === 0) docker(['rm', '-f', 'naskah-evaluation'], true);
  docker(
    [
      'run',
      '-d',
      '--name',
      'naskah-evaluation',
      '--label',
      `naskah.evaluation=${containerHash}`,
      '--restart',
      'unless-stopped',
      '-p',
      '127.0.0.1:8010:8010',
      '--env-file',
      envPath,
      '--read-only',
      '--tmpfs',
      '/tmp:rw,nosuid,nodev,size=128m,mode=1777',
      '--cap-drop',
      'ALL',
      '--security-opt',
      'no-new-privileges',
      '--memory',
      '3g',
      '--cpus',
      '2',
      '--pids-limit',
      '64',
      '--health-cmd',
      `python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8010/health',timeout=3)"`,
      '--health-interval',
      '15s',
      '--health-timeout',
      '5s',
      '--health-retries',
      '3',
      'naskah-evaluation:local',
    ],
    true,
  );
}
let ready = false;
for (let i = 0; i < 30; i++) {
  try {
    if ((await fetch('http://127.0.0.1:8010/health', { signal: AbortSignal.timeout(3000) })).ok) {
      ready = true;
      break;
    }
  } catch {}
  await new Promise((resolve) => setTimeout(resolve, 500));
}
if (!ready) throw new Error('Evaluation health check failed.');
console.log('Evaluasi Python lokal siap pada 127.0.0.1:8010.');
