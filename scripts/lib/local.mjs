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
  const r = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
    ...options,
  });
  if (r.error || r.status !== 0)
    throw new Error(
      `${command} failed (${r.status ?? 'launch'}). ${options.safeOutput ? r.stderr : 'Inspect the tool locally; output withheld to avoid exposing secrets.'}`,
    );
  return r.stdout;
}
export function supabase(args) {
  if (process.env.SUPABASE_CLI_PATH) return run(process.env.SUPABASE_CLI_PATH, args);
  // Bundled Codex runtimes ship pnpm without npm/npx. Invoke its JS entry directly:
  // no shell, no path-specific username, and no shell interpolation of SQL arguments.
  const pnpmCli =
    process.env.PNPM_CLI_PATH || resolve(process.execPath, '../../node_modules/pnpm/bin/pnpm.mjs');
  if (existsSync(pnpmCli))
    return run(process.execPath, [pnpmCli, '--reporter=silent', 'dlx', 'supabase@3.0.0', ...args]);
  const npmCli =
    process.env.NPX_CLI_PATH ||
    (process.platform === 'win32'
      ? resolve(
          process.env.ProgramFiles || 'C:/Program Files',
          'nodejs/node_modules/npm/bin/npx-cli.js',
        )
      : undefined);
  if (npmCli && existsSync(npmCli))
    return run(process.execPath, [npmCli, '--yes', 'supabase@3.0.0', ...args]);
  return run('npx', ['--yes', 'supabase@3.0.0', ...args]);
}
