import { test } from 'node:test';
import assert from 'node:assert/strict';
import { worker } from './worker.mjs';
test('successful worker returns bounded output', async () =>
  assert.equal(await worker(process.execPath, ['-e', "process.stdout.write('ok')"], 1000), 'ok'));
test('timeout kills a hanging worker', async () => {
  const start = Date.now();
  await assert.rejects(
    worker(process.execPath, ['-e', 'setInterval(()=>{},1000)'], 100),
    /document_timeout/,
  );
  assert.ok(Date.now() - start < 2000);
});
test('unbounded output is killed', async () =>
  assert.rejects(
    worker(
      process.execPath,
      ['-e', "setInterval(()=>process.stdout.write('x'.repeat(1000)),1)"],
      1000,
      2000,
    ),
    /too_large/,
  ));
test('failed worker exposes only a stable error', async () =>
  assert.rejects(
    worker(
      process.execPath,
      ['-e', "console.log(JSON.stringify({error:'invalid_file'}));process.exit(1)"],
      1000,
    ),
    /invalid_file/,
  ));

import { mkdtemp, access, rm } from 'node:fs/promises';
import { join } from 'node:path';
test('failed parent cannot leave a running descendant', async () => {
  const dir = await mkdtemp('/tmp/naskah-worker-test-'),
    marker = join(dir, 'leaked');
  const descendant =
    "setTimeout(()=>require('node:fs').writeFileSync(process.argv[1],'leaked'),300)";
  const parent =
    "require('node:child_process').spawn(process.execPath,['-e',process.argv[1],process.argv[2]],{stdio:'ignore'}).unref();process.exit(1)";
  try {
    await assert.rejects(
      worker(process.execPath, ['-e', parent, descendant, marker], 1000),
      /compiler_failed/,
    );
    await new Promise((resolve) => setTimeout(resolve, 500));
    await assert.rejects(access(marker));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
