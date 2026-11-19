import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { root } from './lib/local.mjs';

const [mode, ...args] = process.argv.slice(2);
if (!['dev', 'start'].includes(mode)) throw new Error('Gunakan start-web.mjs dev|start.');
const web = resolve(root, 'apps/web');
const lockfile = resolve(root, 'pnpm-lock.yaml');
const cache = resolve(root, 'node_modules/.cache/sreques');
const installedLockfile = resolve(cache, 'startup-lock.sha256');
const lockHash = createHash('sha256')
  .update(readFileSync(lockfile, 'utf8').replaceAll('\r\n', '\n'))
  .digest('hex');
const sameLockfile =
  existsSync(installedLockfile) && readFileSync(installedLockfile, 'utf8') === lockHash;

function runScript(file, scriptArgs = []) {
  const result = spawnSync(process.execPath, [file, ...scriptArgs], {
    cwd: root,
    stdio: 'inherit',
    windowsHide: true,
  });
  if (result.error || result.status !== 0) process.exit(result.status || 1);
}

if (!sameLockfile || !existsSync(resolve(web, 'node_modules/next/package.json'))) {
  const pnpm = [process.env.PNPM_CLI_PATH, process.env.npm_execpath].find(
    (file) => file && existsSync(file) && /\.[cm]?js$/i.test(file),
  );
  if (!pnpm)
    throw new Error('Jalankan lewat pnpm dev agar dependency proyek dapat dipasang otomatis.');
  console.log('Menyiapkan dependency proyek sesuai lockfile…');
  runScript(pnpm, ['install', '--frozen-lockfile']);
  mkdirSync(cache, { recursive: true });
  writeFileSync(installedLockfile, lockHash);
}

runScript(resolve(root, 'scripts/local-evaluation.mjs'));
const require = createRequire(resolve(web, 'package.json'));
const child = spawn(
  process.execPath,
  [require.resolve('next/dist/bin/next'), mode, '--hostname', '127.0.0.1', ...args],
  {
    cwd: web,
    stdio: 'inherit',
    windowsHide: true,
  },
);
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('error', () => {
  console.error('Webapp gagal dimulai.');
  process.exitCode = 1;
});
child.on('exit', (code, signal) => {
  process.exitCode = signal ? 0 : (code ?? 1);
});
