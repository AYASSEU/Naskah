import { spawnSync } from 'node:child_process';

const result = spawnSync(
  process.execPath,
  [
    '--conditions=react-server',
    '--env-file=apps/web/.env.local',
    '--import',
    'tsx',
    'scripts/setup-local-mock.ts',
  ],
  {
    stdio: 'inherit',
    windowsHide: true,
    env: { ...process.env, TSX_TSCONFIG_PATH: 'apps/web/tsconfig.json' },
  },
);
process.exitCode = result.status ?? 1;
