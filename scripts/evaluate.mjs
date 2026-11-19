import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { root } from './lib/local.mjs';
const [operation, ...args] = process.argv.slice(2);
if (!['sus', 'expert', 'structure', 'rouge', 'bertscore', 'stats', 'export'].includes(operation))
  throw new Error('Use sus|expert|structure|rouge|stats|export --input path --output path');
const read = (key, fallback) => {
  const index = args.indexOf(key);
  return index < 0 ? fallback : args[index + 1];
};
const output = resolve(
  read(
    '--output',
    operation === 'export'
      ? 'artifacts/evaluation-export'
      : `artifacts/evaluation-${operation}.json`,
  ),
);
let result;
if (operation === 'export') {
  const python =
    process.env.EVALUATION_PYTHON_PATH ||
    resolve(dirname(process.execPath), '../../python/python.exe');
  const executable = existsSync(python) ? python : 'python';
  result = spawnSync(
    executable,
    [
      '-m',
      'evaluation_scripts',
      'export',
      '--scope',
      read('--scope', 'research'),
      '--output',
      output,
    ],
    { cwd: resolve(root, 'evaluation-scripts'), windowsHide: true, stdio: 'inherit' },
  );
} else {
  const input = read('--input');
  if (!input || !existsSync(resolve(input)))
    throw new Error('Provide an existing JSON input file.');
  mkdirSync(dirname(output), { recursive: true });
  const command = [
    'run',
    '--rm',
    '--network',
    'none',
    '--read-only',
    '--tmpfs',
    '/tmp:rw,size=128m,mode=1777',
    '--memory',
    '3g',
    '--cpus',
    '2',
    '--mount',
    `type=bind,source=${resolve(input)},target=/data/input.json,readonly`,
    '--mount',
    `type=bind,source=${dirname(output)},target=/data/output`,
    '--entrypoint',
    'python',
    'naskah-evaluation:local',
    '-m',
    'evaluation_scripts',
    operation,
    '--input',
    '/data/input.json',
    '--output',
    '/data/output/' + basename(output),
  ];
  if (args.includes('--allow-language-mismatch')) command.push('--allow-language-mismatch');
  result = spawnSync('docker', command, { cwd: root, windowsHide: true, stdio: 'inherit' });
}
if (result.error || result.status !== 0) process.exitCode = result.status || 1;
else console.log('Evaluation output written locally.');
