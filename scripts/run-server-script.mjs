import { spawnSync } from 'node:child_process';
const scripts = {
  b6: 'scripts/test-b6.ts',
  deploy: 'scripts/deploy-workflows.ts',
  test: 'scripts/test-b5.ts',
};
const target = scripts[process.argv[2]];
if (!target) throw new Error('Use deploy or test');
const result = spawnSync(
  process.execPath,
  ['--conditions=react-server', '--env-file=apps/web/.env.local', '--import', 'tsx', target],
  {
    stdio: 'inherit',
    windowsHide: true,
    env: { ...process.env, TSX_TSCONFIG_PATH: 'apps/web/tsconfig.json' },
  },
);
process.exitCode = result.status ?? 1;
