import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import {
  N8nClient,
  N8nApiError,
  type Workflow,
  type WorkflowNode,
} from '../apps/web/src/server/n8n/client';
import { env } from '../apps/web/src/server/config/env.server';
import { buildRendererCode, rendererWorkflow } from '../n8n/build.mjs';
import { ieeeTemplate, renderManuscript } from '../packages/core/src/index';
import { fixtureProjects, makeDocument } from '../apps/web/src/services/mock/fixtures';
import type { ChapterDraft } from '../packages/contracts/src/index';

async function main() {
  const cfg = env();
  if (!cfg.N8N_API_KEY) throw new Error('n8n_api_key_missing');
  const client = new N8nClient(cfg.N8N_BASE_URL, cfg.N8N_API_KEY);
  const credentials = await client.list<{ id: string; name: string; type: string }>('credentials');
  const inbound = credentials.filter(
    (c) => c.name === 'naskah/webhook-inbound' && c.type === 'httpHeaderAuth',
  );
  if (inbound.length !== 1) throw new Error('webhook_credential_missing_or_ambiguous');
  const definition = rendererWorkflow(await buildRendererCode());
  const generated: Workflow = {
    ...definition,
    nodes: definition.nodes.map((node): WorkflowNode => ({
      ...node,
      position: [node.position[0]!, node.position[1]!],
      credentials: node.credentials
        ? { httpHeaderAuth: { id: inbound[0]!.id, name: inbound[0]!.name } }
        : undefined,
    })),
  };
  const matching = (await client.list<Workflow>('workflows')).filter(
    (w) => w.name === generated.name,
  );
  if (matching.length > 1) throw new Error('workflow_name_ambiguous');
  if (matching[0]?.id) {
    const prior = await client.request<Workflow>(`workflows/${matching[0].id}`);
    if (prior.nodes.some((node) => !generated.nodes.some((n) => n.name === node.name)))
      throw new Error('workflow_has_unexpected_nodes_review_required');
    generated.id = prior.id;
    const remappedIds = new Map<string, string>();
    for (const node of generated.nodes) {
      const old = prior.nodes.find((n) => n.name === node.name);
      if (old) {
        remappedIds.set(node.id, old.id);
        node.id = old.id;
        node.position = old.position;
      }
    }
    generated.nodeGroups =
      prior.nodeGroups ??
      (generated.nodeGroups as { nodeIds: string[] }[]).map((group) => ({
        ...group,
        nodeIds: group.nodeIds.map((id) => remappedIds.get(id) ?? id),
      }));
    generated.settings.availableInMCP = prior.settings.availableInMCP ?? false;
  }
  const saved = await client.putWorkflow(generated);
  if (!saved.id) throw new Error('workflow_id_missing');
  await client.activate(saved.id);
  const readback = await client.request<Workflow>(`workflows/${saved.id}`);
  assert.equal(readback.active, true);
  assert.equal(readback.nodes[0]!.credentials?.httpHeaderAuth?.id, inbound[0]!.id);
  assert.equal(readback.settings.saveDataSuccessExecution, 'none');
  assert.equal(readback.settings.saveDataErrorExecution, 'none');
  assert.equal(readback.settings.saveManualExecutions, false);
  const publishedSource = JSON.stringify(readback);
  for (const secret of [
    cfg.N8N_API_KEY,
    cfg.N8N_WEBHOOK_SECRET,
    cfg.N8N_CALLBACK_SECRET,
    cfg.SUPABASE_SERVICE_ROLE_KEY,
    cfg.APP_ENCRYPTION_KEY,
  ])
    if (secret)
      assert.ok(!publishedSource.includes(secret), 'Secret value found in workflow definition');

  const cases: { name: string; chapters: ChapterDraft[] }[] = fixtureProjects.map(
    (project, index) => {
      const document = makeDocument(project);
      return {
        name: `phase1-${index + 1}`,
        chapters: ieeeTemplate.chapters.map((chapter) => ({
          number: chapter.number,
          title: chapter.title,
          sections: chapter.subsections.map((subsection) => ({
            number: subsection.number,
            title: subsection.title,
            body: document.sections.find((s) => s.number === subsection.number)!.markdown,
            requirements: [],
          })),
        })),
      };
    },
  );
  cases.push({
    name: 'structured-fields',
    chapters: [
      {
        number: '3',
        title: 'Specific Requirements',
        sections: [
          {
            number: '3.2',
            title: 'Functional Requirements',
            body: 'Synthetic contract fixture.',
            requirements: [
              {
                id: 'REQ-F-01',
                title: 'Pendaftaran *pasien*',
                description: 'Sistem harus menyimpan data tervalidasi.',
                actor: 'Petugas',
                input: 'NIK\nNama lengkap',
                process: 'Validasi dan penyimpanan',
                output: 'Nomor rekam medis',
                priority: 'Medium',
              },
            ],
          },
        ],
      },
    ],
  });
  const checks = [];
  for (const fixture of cases) {
    const expected = renderManuscript(fixture.chapters);
    const result = await client.webhook(
      'naskah-smoke-markdown',
      cfg.N8N_WEBHOOK_SECRET,
      { chapters: fixture.chapters },
      60000,
    );
    assert.equal(result.status, 200);
    assert.ok(result.data && typeof result.data === 'object' && 'markdown' in result.data);
    assert.equal(result.data.markdown, expected, `Byte mismatch: ${fixture.name}`);
    checks.push({
      fixture: fixture.name,
      http: result.status,
      byteIdentical: true,
      markdownBytes: Buffer.byteLength(expected),
    });
  }
  await assert.rejects(
    () =>
      client.webhook('naskah-smoke-markdown', 'naskah-deliberately-invalid-token', {
        chapters: cases[0]!.chapters,
      }),
    (error: unknown) => error instanceof N8nApiError && [401, 403].includes(error.httpStatus),
  );
  await mkdir('artifacts', { recursive: true });
  await writeFile(
    'artifacts/n8n-markdown-verification.json',
    JSON.stringify(
      {
        workflowId: saved.id,
        workflowName: saved.name,
        verifiedAt: new Date().toISOString(),
        transport: 'authenticated production webhook',
        http: 200,
        byteIdentical: true,
        checks,
        invalidTokenRejected: true,
        workflowSecretScan: true,
        syntheticFixture: true,
      },
      null,
      2,
    ),
  );
  console.log(
    `Shared Markdown webhook verified byte-identical for ${checks.length} fixtures; invalid token rejected; workflow ${saved.id}.`,
  );
}
main().catch((error: unknown) => {
  const failure = error as { code?: string; httpStatus?: number };
  console.error(failure.code ?? 'markdown_deploy_or_test_failed', failure.httpStatus ?? '');
  process.exitCode = 1;
});
