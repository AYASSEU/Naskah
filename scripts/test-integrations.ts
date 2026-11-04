import assert from 'node:assert/strict';
import { randomBytes, createHash } from 'node:crypto';
import {
  saveIntegration,
  deleteIntegration,
  reapplyIntegrations,
} from '../apps/web/src/server/integrations/credential-sync';
import { readSecret, n8nClient, integrationState } from '../apps/web/src/server/integrations/store';
import { env } from '../apps/web/src/server/config/env.server';
import { sql } from '../apps/web/src/server/db/client';

async function main() {
  const owner = env().LOCAL_OWNER_ID,
    keys = [0, 1].map(() => `naskah-test-${randomBytes(24).toString('hex')}`);
  const config = {
    baseUrl: 'http://host.docker.internal:4010/v1',
    model: 'deepseek-flash',
    dimensions: 1536,
    preset: 'custom' as const,
  };
  const client = await n8nClient(owner);
  await assert.rejects(
    () =>
      saveIntegration(owner, 'deepseek', {
        ...config,
        apiKey: `invalid-${randomBytes(24).toString('hex')}`,
      }),
    (e) => !!e && typeof e === 'object' && 'code' in e && e.code === 'invalid_api_key',
  );
  const initial = await saveIntegration(owner, 'deepseek', { ...config, apiKey: keys[0] });
  assert.equal(
    initial.tested,
    true,
    `Initial sync failed at ${initial.step}: ${initial.error_code}`,
  );
  const row = await readSecret(owner, 'deepseek');
  assert.ok(row);
  assert.ok(!JSON.stringify(row).includes(keys[0]!));
  const rotated = await saveIntegration(owner, 'deepseek', { ...config, apiKey: keys[1] });
  assert.equal(rotated.tested, true, `Rotation failed: ${rotated.error_code}`);
  const captures = (await fetch('http://localhost:4010/__test/requests', {
    headers: { Authorization: `Bearer ${process.env.MOCK_CONTROL_TOKEN}` },
  }).then((r) => r.json())) as { requests: { keyHash: string }[] };
  assert.ok(
    captures.requests.some(
      (r) => r.keyHash === createHash('sha256').update(keys[1]!).digest('hex'),
    ),
  );
  const response = await deleteIntegration(owner, 'deepseek');
  assert.equal(response.configured, false);
  assert.equal((await integrationState(owner, 'deepseek')).tested, false);
  await saveIntegration(owner, 'deepseek', { ...config, apiKey: keys[1] });
  const credentials = await client.list<{ id: string; name: string }>('credentials');
  // Only Naskah-owned test integration credentials; never wipe the user's volume.
  for (const c of credentials.filter((c) => c.name === 'naskah/deepseek'))
    await client.request(`credentials/${c.id}`, 'DELETE');
  await reapplyIntegrations(owner);
  assert.equal((await integrationState(owner, 'deepseek')).tested, true);
  const emb = await saveIntegration(owner, 'embeddings', {
    ...config,
    model: 'text-embedding-3-small',
    apiKey: keys[1],
  });
  assert.equal(emb.tested, true, `Embedding smoke: ${emb.error_code}`);
  const workflows = await client.list<{ id: string; name: string }>('workflows');
  const safeOutputs = [initial, rotated, response, emb];
  for (const w of workflows.filter((w) => w.name.startsWith('Naskah / ')))
    safeOutputs.push(await client.request(`workflows/${w.id}`));
  const executions = await client.list<{ id: string }>('executions');
  for (const execution of executions.slice(0, 20))
    safeOutputs.push(await client.request(`executions/${execution.id}?includeData=true`));
  for (const key of keys)
    assert.ok(
      !JSON.stringify(safeOutputs).includes(key),
      'Secret leaked into response/workflow/execution',
    );
  console.log(
    'Credential create, PATCH rotation, deletion, recovery, two provider smokes, invalid-key rejection, and output secret scan passed.',
  );
}
main()
  .then(() => sql().end())
  .catch(async (e) => {
    console.error(
      e instanceof assert.AssertionError ? e.message : e?.code || 'integration_test_failed',
    );
    await sql().end();
    process.exitCode = 1;
  });
