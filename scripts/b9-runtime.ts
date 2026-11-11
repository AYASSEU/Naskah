import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { env } from '../apps/web/src/server/config/env.server';
import { db, sql } from '../apps/web/src/server/db/client';
import { readSecret, decryptSecret, n8nClient } from '../apps/web/src/server/integrations/store';
import { reapplyIntegrations } from '../apps/web/src/server/integrations/credential-sync';
import type { Workflow } from '../apps/web/src/server/n8n/client';
const cfg = env(),
  base = 'http://127.0.0.1:3000',
  runtime = resolve(process.env.LOCALAPPDATA ?? '/tmp', 'naskah-runtime'),
  backup = resolve(runtime, 'b9-integrations-backup.json');
const ids = ['deepseek', 'embeddings'] as const;
const names = new Set([
  'naskah/deepseek',
  'naskah/embeddings',
  'naskah/webhook-inbound',
  'naskah/callback-bearer',
  'naskah/supabase-rest',
]);
async function guard() {
  const h = await (await fetch('http://127.0.0.1:4010/health')).json();
  assert.equal(h.mock, true);
  for (const id of ids) {
    const row = await readSecret(cfg.LOCAL_OWNER_ID, id);
    assert.ok(row, 'Local mock integration missing.');
    const url = new URL((row.config as { baseUrl: string }).baseUrl);
    assert.ok(
      ['localhost', '127.0.0.1', 'host.docker.internal'].includes(url.hostname) &&
        url.port === '4010',
      'B9 requires mock providers only.',
    );
    assert.ok(
      decryptSecret(row).startsWith('naskah-test-'),
      'Refusing to handle non-test provider keys.',
    );
  }
}
async function api(path: string, method = 'GET') {
  const r = await fetch(base + '/api/auth/session', { headers: { 'X-Naskah-Client': 'web' } });
  assert.ok(r.ok);
  const cookie = r.headers.get('set-cookie')!.split(';')[0]!;
  const response = await fetch(base + path, {
    method,
    headers: { Cookie: cookie, Origin: base, 'X-Naskah-Client': 'web' },
  });
  assert.ok(response.ok, 'Local B9 API request failed.');
  return response.json();
}
async function main() {
  const command = process.argv[2];
  if (command === 'preflight') {
    await guard();
    assert.ok(
      (
        /<footer\b[\s\S]*?<\/footer>/.exec(await (await fetch(base + '/evaluation')).text())?.[0] ??
        ''
      ).includes('Mode tersambung'),
      'B9 requires live backend UI mode.',
    );
    assert.equal((await api('/api/system/status')).ready, true);
    mkdirSync(runtime, { recursive: true });
    if (!existsSync(backup)) {
      const rows = await Promise.all(ids.map((id) => readSecret(cfg.LOCAL_OWNER_ID, id)));
      writeFileSync(backup, JSON.stringify({ owner: cfg.LOCAL_OWNER_ID, rows }), { mode: 0o600 });
    }
    assert.equal(JSON.parse(readFileSync(backup, 'utf8')).owner, cfg.LOCAL_OWNER_ID);
    console.log('B9 local/mock preflight and encrypted recovery snapshot ready.');
  } else if (command === 'reset-credentials') {
    await guard();
    assert.ok(existsSync(backup), 'B9 encrypted recovery snapshot required.');
    const client = await n8nClient();
    const credentials = await client.list<{ id: string; name: string }>('credentials');
    for (const credential of credentials.filter((c) => names.has(c.name)))
      await client.request('credentials/' + encodeURIComponent(credential.id), 'DELETE');
    console.log('Removed only the five Naskah-owned local test credential types.');
  } else if (command === 'inspect') {
    await guard();
    const client = await n8nClient();
    const credentials = await client.list<{ id: string; name: string; type: string }>(
      'credentials',
    );
    const workflows = [];
    for (const listed of await client.list<Workflow>('workflows'))
      if (listed.id && listed.name.startsWith('Naskah / ')) {
        const w = await client.request<Workflow>('workflows/' + listed.id);
        workflows.push({
          id: w.id,
          name: w.name,
          active: w.active,
          nodes: w.nodes.map((n) => ({
            id: n.id,
            name: n.name,
            position: n.position,
            credentials: n.credentials,
          })),
        });
      }
    console.log(
      JSON.stringify({
        credentials: credentials
          .filter((c) => names.has(c.name))
          .map((c) => ({ id: c.id, name: c.name, type: c.type })),
        workflows,
      }),
    );
  } else if (command === 'restore') {
    if (existsSync(backup)) {
      const data = JSON.parse(readFileSync(backup, 'utf8')) as {
        owner: string;
        rows: NonNullable<Awaited<ReturnType<typeof readSecret>>>[];
      };
      assert.equal(data.owner, cfg.LOCAL_OWNER_ID);
      for (const row of data.rows) {
        assert.ok(ids.includes(row.provider as (typeof ids)[number]));
        assert.equal(row.owner_id, cfg.LOCAL_OWNER_ID);
        const result = await db().from('integration_secrets').upsert(row);
        assert.equal(result.error, null);
      }
      await reapplyIntegrations(cfg.LOCAL_OWNER_ID);
      assert.equal((await api('/api/system/status')).ready, true);
      unlinkSync(backup);
    }
    await fetch('http://127.0.0.1:4010/__test/reset', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + process.env.MOCK_CONTROL_TOKEN },
    });
    console.log('Original local mock integrations restored and verified.');
  } else if (command === 'cleanup') {
    const manifest = 'artifacts/b9/cleanup.jsonl';
    if (existsSync(manifest))
      for (const line of readFileSync(manifest, 'utf8').split('\n').filter(Boolean)) {
        const entry = JSON.parse(line);
        assert.match(entry.prefix, /^B9UI_[a-f0-9]{8}$/);
        for (const id of entry.projects ?? []) {
          assert.match(id, /^[a-f0-9-]{36}$/);
          const [p] =
            await sql()`select id,title from public.projects where id=${id} and owner_id=${cfg.LOCAL_OWNER_ID}`;
          if (p) {
            assert.ok(String(p.title).startsWith(entry.prefix));
            await api('/api/projects/' + id, 'DELETE');
          }
        }
        await sql()`delete from public.participants where owner_id=${cfg.LOCAL_OWNER_ID} and not is_thesis_run and code in (${entry.prefix + '_one'},${entry.prefix + '_two'})`;
        for (const digest of entry.digests ?? []) {
          assert.match(digest, /^[a-f0-9]{64}$/);
          await sql()`delete from public.statistical_results where owner_id=${cfg.LOCAL_OWNER_ID} and not is_thesis_run and result->'provenance'->>'input_digest'=${digest}`;
        }
      }
    console.log('Removed only recorded B9 synthetic projects, participants and derived reports.');
  } else if (command === 'scan') {
    await guard();
    const client = await n8nClient(),
      secrets = [
        cfg.N8N_API_KEY,
        cfg.N8N_WEBHOOK_SECRET,
        cfg.N8N_CALLBACK_SECRET,
        cfg.SUPABASE_SERVICE_ROLE_KEY,
        cfg.APP_ENCRYPTION_KEY,
      ].filter((s): s is string => !!s);
    for (const id of ids) {
      const row = await readSecret(cfg.LOCAL_OWNER_ID, id);
      if (row) secrets.push(decryptSecret(row));
    }
    const check = (text: string, label: string) =>
      assert.ok(
        !secrets.some((s) => s.length >= 20 && text.includes(s)) &&
          !/naskah-test-b9-[a-f0-9]{32}/.test(text),
        'Credential leakage: ' + label,
      );
    for (const w of await client.list<Workflow>('workflows'))
      if (w.id && w.name.startsWith('Naskah / '))
        check(JSON.stringify(await client.request('workflows/' + w.id)), 'workflow');
    for (const execution of (await client.list<{ id: string }>('executions')).slice(0, 30))
      check(
        JSON.stringify(await client.request('executions/' + execution.id + '?includeData=true')),
        'execution',
      );
    for (const name of ['web.stdout.log', 'web.stderr.log']) {
      const file = resolve(runtime, name);
      if (existsSync(file)) check(readFileSync(file, 'utf8'), name);
    }
    console.log('Workflow/execution exports and local server logs contain no tested credentials.');
  } else throw new Error('Use preflight|reset-credentials|inspect|restore|cleanup|scan');
}
main()
  .catch((error) => {
    console.error(
      'B9 runtime check failed (' +
        process.argv[2] +
        '): ' +
        (error?.code ?? 'check_failed') +
        (typeof error?.httpStatus === 'number' ? ' HTTP ' + error.httpStatus : ''),
    );
    process.exitCode = 1;
  })
  .finally(() => sql().end());
