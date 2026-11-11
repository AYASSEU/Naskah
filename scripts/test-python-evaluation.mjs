import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
const result = spawnSync(
  'docker',
  [
    'run',
    '--rm',
    '--network',
    'none',
    '--read-only',
    '--tmpfs',
    '/tmp:rw,size=128m,mode=1777',
    '--mount',
    `type=bind,source=${resolve('tests/fixtures/evaluation')},target=/fixtures,readonly`,
    '--mount',
    `type=bind,source=${resolve('evaluation-scripts/tests')},target=/tests,readonly`,
    '--entrypoint',
    'python',
    'naskah-evaluation:local',
    '-m',
    'unittest',
    'discover',
    '-s',
    '/tests',
    '-v',
  ],
  { windowsHide: true, stdio: 'inherit' },
);
process.exitCode = result.status ?? 1;
