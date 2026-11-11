import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
const results = [];
let prepared = false;
mkdirSync('artifacts/b9', { recursive: true });
function run(label, args, env = {}) {
  const at = Date.now(),
    r = spawnSync(process.execPath, args, {
      windowsHide: true,
      stdio: 'inherit',
      env: { ...process.env, ...env },
    });
  results.push({ label, passed: r.status === 0, ms: Date.now() - at });
  if (r.error || r.status !== 0) throw new Error('B9 check failed: ' + label);
}
const helper = (command) =>
  run(
    'runtime ' + command,
    [
      '--conditions=react-server',
      '--env-file=apps/web/.env.local',
      '--import',
      'tsx',
      'scripts/b9-runtime.ts',
      command,
    ],
    { TSX_TSCONFIG_PATH: 'apps/web/tsconfig.json' },
  );
try {
  helper('preflight');
  prepared = true;
  run('all live browser counterparts', ['scripts/test-ui-safe.mjs'], { NASKAH_E2E_MODE: 'live' });
  run('B5 workflow regressions', ['scripts/run-server-script.mjs', 'test']);
  run('B6 HTTP regressions', ['scripts/run-server-script.mjs', 'b6']);
  run('B7 document acceptance', ['scripts/test-b7.mjs']);
  run('Compiler process lifecycle', ['scripts/test-compiler-lifecycle.mjs']);
  run('B8 evaluation acceptance', ['scripts/test-b8.mjs']);
  run('Python evaluation', ['scripts/test-python-evaluation.mjs']);
  run('Database isolation', ['scripts/test-database.mjs']);
  helper('scan');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (prepared) {
    try {
      run('B8 UI cleanup', ['scripts/cleanup-b8-ui.mjs']);
    } catch {
      process.exitCode = 1;
    }
    for (const command of ['restore', 'cleanup'])
      try {
        helper(command);
      } catch {
        process.exitCode = 1;
      }
  }
  writeFileSync(
    'artifacts/b9/acceptance.json',
    JSON.stringify(
      {
        at: new Date().toISOString(),
        passed: process.exitCode !== 1,
        mockOnly: true,
        realProviderRun: 'pending_user',
        results,
      },
      null,
      2,
    ),
  );
}
