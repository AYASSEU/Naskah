import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
const secrets = [];
for (const line of readFileSync('apps/web/.env.local', 'utf8').split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line);
  if (m && /KEY|TOKEN|SECRET|PASSWORD|DATABASE_URL/.test(m[1]) && m[2].length >= 20)
    secrets.push(m[2].trim().replace(/^(["'])(.*)\1$/, '$2'));
}
function git(args) {
  const r = spawnSync('git', args, { encoding: 'utf8', windowsHide: true });
  if (r.status !== 0) throw Error('Git scan inventory unavailable.');
  return r.stdout.split('\0').filter(Boolean);
}
const files = new Set([
  ...git(['ls-files', '-z']),
  ...git(['ls-files', '--others', '--exclude-standard', '-z']),
]);
function walk(directory) {
  if (!existsSync(directory)) return;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const p = join(directory, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (/\.(?:json|txt|log|md|html|js)$/.test(entry.name)) files.add(p);
  }
}
walk('artifacts');
walk('test-results');
walk('apps/web/.next/static');
let checked = 0;
for (const path of files) {
  if (!existsSync(path) || !statSync(path).isFile()) continue;
  const text = readFileSync(path, 'utf8');
  if (
    secrets.some((s) => text.includes(s)) ||
    /\bsk-[A-Za-z0-9_-]{32,}\b|github_pat_[A-Za-z0-9_]{30,}|naskah-test-b9-[a-f0-9]{32}|naskah-(?:owner|evaluation-(?:dev|research))=[A-Za-z0-9_.-]{40,}/.test(
      text,
    )
  )
    throw Error('Credential-like value found in ' + resolve(path));
  checked++;
}
console.log('Repository, artifacts and public bundles secret scan passed (' + checked + ' files).');
