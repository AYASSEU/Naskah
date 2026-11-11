import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
process.loadEnvFile('apps/web/.env.local');
const base = 'http://127.0.0.1:8000';
const inspect = spawnSync(
  'docker',
  ['inspect', '--format', '{{.HostConfig.Init}}', 'naskah-compiler'],
  { encoding: 'utf8', windowsHide: true },
);
assert.equal(inspect.status, 0);
assert.equal(inspect.stdout.trim(), 'true', 'Compiler requires Docker --init.');
const probe = `import json
from pathlib import Path
states=[]
for p in Path('/proc').iterdir():
 if not p.name.isdigit():continue
 try:
  states.append((p/'status').read_text().split('State:')[1].splitlines()[0].strip())
 except (FileNotFoundError,ProcessLookupError):pass
print(json.dumps({'zombies':sum(s.startswith('Z') for s in states),'processes':len(states),'init':Path('/proc/1/comm').read_text().strip()}))`;
function processes() {
  const r = spawnSync('docker', ['exec', 'naskah-compiler', 'python3', '-c', probe], {
    encoding: 'utf8',
    windowsHide: true,
  });
  assert.equal(r.status, 0, 'Compiler process probe failed.');
  return JSON.parse(r.stdout);
}
async function settled() {
  const deadline = Date.now() + 3000;
  let state;
  do {
    state = await (await fetch(base + '/health')).json();
    if (state.active === 0) break;
    await new Promise((r) => setTimeout(r, 25));
  } while (Date.now() < deadline);
  assert.equal(state.active, 0);
  return state;
}
const before = processes(),
  samples = [];
assert.equal(before.init, 'docker-init');
assert.equal(before.zombies, 0);
for (let i = 1; i <= 30; i++) {
  const response = await fetch(base + '/compile', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + process.env.COMPILER_SERVICE_TOKEN,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      markdown:
        '# 1. Introduction\n\nSistem harus mencatat audit akses lokal.\n\n## 1.1 Purpose\n\nSynthetic B9 lifecycle ' +
        i +
        '.',
      metadata: {
        title: 'B9 synthetic lifecycle ' + i,
        project: 'B9 synthetic lifecycle',
        version: '1.0',
        author: 'Synthetic',
        institution: 'Naskah',
        date: '2026-11-11',
      },
    }),
    signal: AbortSignal.timeout(95000),
  });
  assert.equal(response.status, 200, 'Repeated document compile failed.');
  const bytes = new Uint8Array(await response.arrayBuffer());
  assert.equal(Buffer.from(bytes.subarray(0, 2)).toString(), 'PK');
  await settled();
  if (i % 5 === 0) {
    let sample = processes(),
      deadline = Date.now() + 3000;
    while (sample.zombies && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 50));
      sample = processes();
    }
    assert.equal(sample.zombies, 0, 'Orphaned processes accumulated.');
    assert.ok(
      sample.processes <= before.processes + 8,
      'Process count grew beyond the idle envelope.',
    );
    samples.push({ job: i, ...sample });
    console.log('Compiler lifecycle ' + i + '/30; zombies=' + sample.zombies);
  }
}
mkdirSync('artifacts/b9', { recursive: true });
writeFileSync(
  'artifacts/b9/compiler-lifecycle.json',
  JSON.stringify({ jobs: 30, before, samples, passed: true }, null, 2),
);
console.log('Thirty repeated compiles preserve zero zombies and bounded process count.');
