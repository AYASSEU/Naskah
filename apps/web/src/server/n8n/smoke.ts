import 'server-only';
import type { IntegrationConfig, IntegrationId } from '@naskah/contracts';
import type { CredentialRef, N8nClient, Workflow, WorkflowNode } from './client';
import { containerProviderUrl } from '../security/urls';

const http = (
  id: string,
  name: string,
  url: string,
  credential: CredentialRef,
  parameters: Record<string, unknown> = {},
): WorkflowNode => ({
  id,
  name,
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.5,
  position: [440, 200],
  parameters: {
    method: 'GET',
    url,
    authentication: 'genericCredentialType',
    genericAuthType: 'httpHeaderAuth',
    options: { timeout: 20000, redirect: { redirect: { followRedirects: false } } },
    ...parameters,
  },
  credentials: { httpHeaderAuth: credential },
  retryOnFail: true,
  maxTries: 3,
  waitBetweenTries: 1000,
});
export function smokeDefinition(
  id: IntegrationId,
  config: IntegrationConfig,
  credential: CredentialRef,
  inbound: CredentialRef,
): Workflow {
  const webhook: WorkflowNode = {
    id: 'start',
    name: 'Authenticated smoke request',
    type: 'n8n-nodes-base.webhook',
    typeVersion: 2.2,
    position: [0, 200],
    parameters: {
      httpMethod: 'POST',
      path: `naskah-smoke-${id}`,
      authentication: 'headerAuth',
      responseMode: 'lastNode',
      options: {},
    },
    credentials: { httpHeaderAuth: inbound },
  };
  const base = containerProviderUrl(config.baseUrl);
  const call =
    id === 'embeddings'
      ? http('provider', 'Embed smoke text', `${base}/embeddings`, credential, {
          method: 'POST',
          sendBody: true,
          specifyBody: 'json',
          jsonBody: JSON.stringify({
            model: config.model,
            input: 'Naskah connection test',
            dimensions: config.dimensions,
          }),
        })
      : http('models', 'List available models', `${base}/models`, credential);
  const nodes = [webhook, call];
  if (id === 'deepseek')
    nodes.push(
      http('completion', 'Complete smoke request', `${base}/chat/completions`, credential, {
        method: 'POST',
        sendBody: true,
        specifyBody: 'json',
        jsonBody: JSON.stringify({
          model: config.model,
          messages: [{ role: 'user', content: 'Reply OK' }],
          max_tokens: 1,
          ...(config.preset === 'deepseek' ? { thinking: { type: 'disabled' } } : {}),
        }),
      }),
    );
  nodes.push({
    id: 'verify',
    name: 'Verify provider response',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [900, 200],
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode:
        id === 'embeddings'
          ? `const vector=$input.first().json.data?.[0]?.embedding;if(!Array.isArray(vector)||vector.length!==${config.dimensions}||!vector.every(Number.isFinite))throw new Error('embedding_dimension_mismatch');return [{json:{ok:true,provider:'embeddings',detail:'Vector dimensions verified'}}];`
          : `const models=$('List available models').first().json.data;if(!Array.isArray(models)||!models.some(m=>m.id===${JSON.stringify(config.model)}))throw new Error('model_not_found');if(!$input.first().json.choices?.length)throw new Error('llm_invalid_output');return [{json:{ok:true,provider:'deepseek',detail:'Models and completion verified'}}];`,
    },
  });
  const connections: Record<string, unknown> = {};
  nodes.forEach((node, index) => {
    node.position = [index * 300, 200];
    if (nodes[index + 1])
      connections[node.name] = {
        main: [[{ node: nodes[index + 1]!.name, type: 'main', index: 0 }]],
      };
  });
  return {
    name: `Naskah / Smoke / ${id}`,
    nodes,
    connections,
    settings: {
      executionOrder: 'v1',
      timezone: 'Asia/Jakarta',
      executionTimeout: 120,
      saveDataSuccessExecution: 'none',
      saveDataErrorExecution: 'none',
      saveManualExecutions: false,
    },
  };
}
export async function ensureSmoke(
  client: N8nClient,
  id: IntegrationId,
  config: IntegrationConfig,
  credential: CredentialRef,
  inbound: CredentialRef,
) {
  const w = smokeDefinition(id, config, credential, inbound);
  const existing = (await client.list<Workflow>('workflows')).find((v) => v.name === w.name);
  if (existing?.id) {
    const full = await client.request<Workflow>(`workflows/${existing.id}`);
    w.id = existing.id;
    for (const node of w.nodes) {
      const old = full.nodes.find((n) => n.name === node.name);
      if (old) node.id = old.id;
    }
    const groups = full.nodeGroups as
      { id: string; name: string; nodeIds: string[]; description?: string }[] | undefined;
    w.nodeGroups =
      groups?.map((g) =>
        g.name === 'Provider verification'
          ? {
              ...g,
              nodeIds: w.nodes.filter((n) => n.type !== 'n8n-nodes-base.webhook').map((n) => n.id),
            }
          : g,
      ) ?? [];
  }
  const saved = await client.putWorkflow(w);
  await client.activate(saved.id!);
  return saved.id!;
}
