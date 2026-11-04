import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

export const root = resolve(import.meta.dirname, '../..');
export const localEnv = resolve(root, 'apps/web/.env.local');
export function loadEnv() {
  if (existsSync(localEnv)) process.loadEnvFile(localEnv);
}
export function setMissingEnv(values) {
  let text = existsSync(localEnv) ? readFileSync(localEnv, 'utf8') : '';
  for (const [key, value] of Object.entries(values)) {
    if (!new RegExp(`^${key}=.+$`, 'm').test(text)) {
      text = text.replace(new RegExp(`^${key}=.*\\r?\\n?`, 'm'), '');
      text += `${text && !text.endsWith('\n') ? '\n' : ''}${key}=${value}\n`;
    }
  }
  writeFileSync(localEnv, text, { mode: 0o600 });
}
export function run(command, args, options = {}) {
  const r = spawnSync(command, args, { cwd: root, encoding: 'utf8', windowsHide: true, ...options });
  if (r.error || r.status !== 0) throw new Error(`${command} failed (${r.status ?? 'launch'}). ${options.safeOutput ? r.stderr : 'Inspect the tool locally; output withheld to avoid exposing secrets.'}`);
  return r.stdout;
}
export function supabase(args) {
  // npx.cmd is a shell script on Windows; use the installed npm CLI with node.
  const npmCli = process.platform === 'win32'
    ? resolve(process.env.ProgramFiles || 'C:/Program Files', 'nodejs/node_modules/npm/bin/npx-cli.js')
    : process.env.NPX_CLI_PATH;
  return npmCli ? run(process.execPath, [npmCli, '--yes', 'supabase@3.0.0', ...args]) : run('npx', ['--yes', 'supabase@3.0.0', ...args]);
}
