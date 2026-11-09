import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { env } from '../apps/web/src/server/config/env.server';
import { sql } from '../apps/web/src/server/db/client';
import { N8nClient, type Workflow } from '../apps/web/src/server/n8n/client';
import { saveIntegration } from '../apps/web/src/server/integrations/credential-sync';
import { readSecret, decryptSecret } from '../apps/web/src/server/integrations/store';
import { providerRegistry } from '../apps/web/src/server/integrations/registry';

async function main() {
  const cfg = env();
  const n8nUrl = new URL(cfg.N8N_BASE_URL);
  if (!cfg.N8N_API_KEY || !['localhost', '127.0.0.1'].includes(n8nUrl.hostname))
    throw new Error('local_n8n_configuration_required');
  const health = await fetch('http://127.0.0.1:4010/health', {
    redirect: 'error',
    signal: AbortSignal.timeout(5000),
  });
  const body = (await health.json()) as { mock?: boolean; ok?: boolean };
  assert.equal(body.mock, true);
  assert.equal(body.ok, true);
  for (const id of ['deepseek', 'embeddings'] as const) {
    const existing = await readSecret(cfg.LOCAL_OWNER_ID, id);
    if (!existing) continue;
    const baseUrl = (existing.config as { baseUrl?: string }).baseUrl;
    const url = baseUrl ? new URL(baseUrl) : undefined;
    if (
      !url ||
      !['localhost', '127.0.0.1', 'host.docker.internal'].includes(url.hostname) ||
      url.port !== '4010' ||
      !decryptSecret(existing).startsWith('naskah-test-')
    )
      throw new Error('refusing_to_replace_non_mock_provider_settings');
  }
  const client = new N8nClient(cfg.N8N_BASE_URL, cfg.N8N_API_KEY);
  type Credential = { id: string; name: string; type: string };
  const before = await client.list<Credential>('credentials');
  const smokeNames = ['Naskah / Smoke / deepseek', 'Naskah / Smoke / embeddings'];
  const beforeWorkflows: Workflow[] = [];
  for (const listed of await client.list<Workflow>('workflows'))
    if (listed.id && smokeNames.includes(listed.name))
      beforeWorkflows.push(await client.request<Workflow>(`workflows/${listed.id}`));
  const states = [];
  const testKeys: string[] = [];
  states.push(
    await saveIntegration(cfg.LOCAL_OWNER_ID, 'n8n', {
      ...providerRegistry.n8n.defaults,
      baseUrl: cfg.N8N_BASE_URL,
      apiKey: cfg.N8N_API_KEY,
    }),
  );
  for (const id of ['deepseek', 'embeddings'] as const) {
    const old = await readSecret(cfg.LOCAL_OWNER_ID, id);
    const key = old ? decryptSecret(old) : `naskah-test-${randomBytes(24).toString('hex')}`;
    testKeys.push(key);
    const state = await saveIntegration(cfg.LOCAL_OWNER_ID, id, {
      ...providerRegistry[id].defaults,
      preset: 'custom',
      baseUrl: 'http://host.docker.internal:4010/v1',
      apiKey: key,
    });
    assert.equal(state.tested, true, `${id}: ${state.step}/${state.error_code}`);
    states.push(state);
  }
  const after = await client.list<Credential>('credentials');
  const expectedNames = [
    'naskah/webhook-inbound',
    'naskah/callback-bearer',
    'naskah/supabase-rest',
    'naskah/deepseek',
    'naskah/embeddings',
  ];
  for (const name of expectedNames) {
    const current = after.filter((c) => c.name === name);
    assert.equal(current.length, 1, `Ambiguous or missing credential: ${name}`);
    const old = before.filter((c) => c.name === name);
    if (old.length === 1) assert.equal(current[0]!.id, old[0]!.id);
  }
  const safeOutputs: unknown[] = [...states];
  for (const old of beforeWorkflows) {
    const current = await client.request<Workflow>(`workflows/${old.id}`);
    safeOutputs.push(current);
    assert.equal(current.active, true);
    assert.equal(current.settings.availableInMCP, old.settings.availableInMCP);
    for (const node of old.nodes) {
      const actual = current.nodes.find((n) => n.name === node.name);
      assert.equal(actual?.id, node.id);
      assert.deepEqual(actual?.position, node.position);
    }
    assert.deepEqual(current.nodeGroups, old.nodeGroups);
  }
  for (const id of ['n8n', 'deepseek', 'embeddings'])
    safeOutputs.push(await readSecret(cfg.LOCAL_OWNER_ID, id));
  const serialized = JSON.stringify(safeOutputs);
  for (const secret of [
    ...testKeys,
    cfg.N8N_API_KEY,
    cfg.N8N_WEBHOOK_SECRET,
    cfg.N8N_CALLBACK_SECRET,
    cfg.SUPABASE_SERVICE_ROLE_KEY,
    cfg.APP_ENCRYPTION_KEY,
  ])
    if (secret)
      assert.ok(
        !serialized.includes(secret),
        'Secret value found in safe response or stored envelope',
      );
  await mkdir('artifacts', { recursive: true });
  await writeFile(
    'artifacts/local-mock-setup.json',
    JSON.stringify(
      {
        verifiedAt: new Date().toISOString(),
        mockOnly: true,
        integrations: states.map(({ id, stored, synced, tested }) => ({
          id,
          stored,
          synced,
          tested,
        })),
        credentialsUnique: true,
        transferredCredentialIdsPreserved: true,
        smokeNodeIdsPositionsGroupsAndMcpPreserved: true,
        secretScan: true,
      },
      null,
      2,
    ),
  );
  console.log(
    'Local Settings setup passed: encrypted n8n connection, unique adopted credentials, two real mock-provider webhooks; existing IDs/layout/MCP preserved.',
  );
}
main()
  .then(() => sql().end())
  .catch(async (error: unknown) => {
    console.error(
      error instanceof assert.AssertionError
        ? error.message
        : ((error as { code?: string }).code ?? 'local_mock_setup_failed'),
    );
    await sql().end();
    process.exitCode = 1;
  });
