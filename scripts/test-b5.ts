import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { env } from '../apps/web/src/server/config/env.server';
import { sql } from '../apps/web/src/server/db/client';
import {
  readSecret,
  decryptSecret,
  storeSecret,
  markIntegration,
} from '../apps/web/src/server/integrations/store';
import { N8nClient, N8nApiError } from '../apps/web/src/server/n8n/client';
import { deployProduction } from './deploy-workflows';
import { reapplyIntegrations } from '../apps/web/src/server/integrations/credential-sync';
import type { Workflow } from '../apps/web/src/server/n8n/client';
import { retrievalQuery } from '../n8n/src/workflow-domain';
import { renderDocumentSections } from '../packages/core/src/index';
import type { Section } from '../packages/contracts/src/index';

const cfg = env(),
  client = new N8nClient(cfg.N8N_BASE_URL, cfg.N8N_API_KEY!),
  control = process.env.MOCK_CONTROL_TOKEN;
type Run = {
  session_id: string;
  run_id: string;
  project_id: string;
  project_title: string;
  domain: string;
  raw_text: string;
};
type Row = {
  status: string;
  error_code: string | null;
  current_stage: string;
  completed_sections: Section[];
  metrics: Record<string, unknown>;
  n8n_execution_id: string;
  callback_event_id: string;
};
const results: { name: string; ms: number; passed: boolean }[] = [];
const created: Run[] = [];
const inspectedExecutions: { id: string; workflowId: string; status: string }[] = [];
const temporaryOwners: string[] = [];
const temporaryChunks: { owner: string; doc: string }[] = [];
const secrets = [
  cfg.N8N_API_KEY!,
  cfg.N8N_WEBHOOK_SECRET,
  cfg.N8N_CALLBACK_SECRET,
  cfg.SUPABASE_SERVICE_ROLE_KEY,
  cfg.APP_ENCRYPTION_KEY,
];
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const digest = (text: string) => createHash('sha256').update(text).digest('hex');
async function mock(command: string, data: unknown = {}) {
  const response = await fetch(`http://127.0.0.1:4010/__test/${command}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${control}`,
    },
    body: JSON.stringify(data),
    signal: AbortSignal.timeout(10000),
  });
  assert.equal(response.status, 200);
  return response.json();
}
async function captures() {
  const data = (await mock('requests')) as {
    requests: Record<string, unknown>[];
  };
  return data.requests;
}
async function until<T>(
  read: () => Promise<T>,
  accept: (value: T) => boolean,
  limit = 120000,
): Promise<T> {
  const end = Date.now() + limit;
  let value: T;
  do {
    value = await read();
    if (accept(value)) return value;
    await sleep(150);
  } while (Date.now() < end);
  throw new Error('b5_condition_timeout');
}
async function readyMock() {
  for (const id of ['deepseek', 'embeddings']) {
    const row = await readSecret(cfg.LOCAL_OWNER_ID, id);
    assert.ok(row);
    const url = new URL((row.config as { baseUrl: string }).baseUrl);
    assert.ok(
      ['localhost', '127.0.0.1', 'host.docker.internal'].includes(url.hostname) &&
        url.port === '4010',
      'Refusing non-mock provider',
    );
    const key = decryptSecret(row);
    assert.ok(key.startsWith('naskah-test-'));
    if (!secrets.includes(key)) secrets.push(key);
  }
}
async function seed(
  label: string,
  text = 'Petugas harus menyimpan data pasien. Sistem harus menyediakan audit akses dan pemeriksaan keamanan.',
  owner = cfg.LOCAL_OWNER_ID,
): Promise<Run> {
  const run = {
    session_id: randomUUID(),
    run_id: randomUUID(),
    project_id: randomUUID(),
    project_title: `B5 synthetic ${label}`,
    domain: 'healthcare',
    raw_text: text,
  };
  await sql()`insert into public.projects(id,owner_id,session_id,title,domain,status,raw_text) values(${run.project_id},${owner},${run.session_id},${run.project_title},${run.domain},'generating',${run.raw_text})`;
  await sql()`insert into public.srs_generation_logs(session_id,owner_id,project_id,project_title,domain,run_id,scenario_label,is_thesis_run) values(${run.session_id},${owner},${run.project_id},${run.project_title},${run.domain},${run.run_id},${'b5-' + label},false)`;
  created.push(run);
  return run;
}
async function start(run: Run, resume?: { from_part: number }) {
  const { project_id: _, ...input } = run;
  const response = await client.webhook('generate-srs', cfg.N8N_WEBHOOK_SECRET, {
    ...input,
    ...(resume
      ? {
          resume: {
            ...resume,
            completed_sections: (await row(run)).completed_sections,
          },
        }
      : {}),
  });
  assert.equal(response.status, 202);
  assert.equal((response.data as { accepted: boolean }).accepted, true);
  const accepted = response.data as { execution_id: string };
  const execution = await client.request<{
    id: string;
    workflowId: string;
    status: string;
    data?: unknown;
  }>(`executions/${accepted.execution_id}?includeData=false`);
  assert.equal(execution.id, accepted.execution_id);
  assert.ok(execution.workflowId && execution.status);
  assert.ok(execution.data == null, 'Execution inspection must exclude request bodies');
  inspectedExecutions.push({
    id: execution.id,
    workflowId: execution.workflowId,
    status: execution.status,
  });
  return accepted;
}
async function row(run: Run) {
  const [value] = await sql()<
    Row[]
  >`select status,error_code,current_stage,completed_sections,metrics,n8n_execution_id,callback_event_id from public.srs_generation_logs where session_id=${run.session_id}`;
  return value!;
}
async function isolatedOwner(embeddingModel?: string) {
  const owner = randomUUID();
  temporaryOwners.push(owner);
  for (const id of ['deepseek', 'embeddings']) {
    const original = await readSecret(cfg.LOCAL_OWNER_ID, id);
    assert.ok(original);
    const config = {
      ...(original.config as Record<string, unknown>),
      ...(id === 'embeddings' && embeddingModel ? { model: embeddingModel } : {}),
    };
    await storeSecret(owner, id, decryptSecret(original), config);
    await markIntegration(owner, id, 'ready');
  }
  return owner;
}
async function chunk(owner: string, vector: number[], model = 'text-embedding-3-small') {
  const doc = 'b5-private-' + randomUUID();
  temporaryChunks.push({ owner, doc });
  const content = doc + ' ' + Array(30).fill('Synthetic private owner requirement.').join(' ');
  await sql()`insert into public.srs_knowledge_base(owner_id,content,embedding,doc_id,dataset_source,domain,ieee_section,chunk_index,token_count,embedding_model,content_hash)
    values(${owner},${content},${'[' + vector.join(',') + ']'}::extensions.vector,${doc},'dev_seed','healthcare','introduction',0,${Math.ceil(content.length / 4)},${model},${digest(content)})`;
  return doc;
}
async function terminal(run: Run, receipt = true) {
  const value = await until(
    () => row(run),
    (r) => ['completed', 'failed', 'cancelled'].includes(r.status),
  );
  if (receipt)
    await until(
      async () => {
        const [r] = await sql()<
          { n: number }[]
        >`select count(*)::int as n from public.callback_receipts where session_id=${run.session_id}`;
        return r!.n;
      },
      (n) => n > 0,
      20000,
    );
  return value;
}
async function sections(run: Run) {
  return sql()<
    {
      section_id: string;
      markdown: string;
      version: number;
      requirements: unknown;
      guardrail: unknown;
    }[]
  >`select section_id,markdown,version,requirements,guardrail from public.sections where project_id=${run.project_id} order by number`;
}
async function revision(run: Run, target: string, instruction: string) {
  const [section] = await sql()<
    { id: string; section_id: string; version: number; markdown: string }[]
  >`select id,section_id,version,markdown from public.sections where project_id=${run.project_id} and section_id=${target}`;
  assert.ok(section);
  const id = randomUUID();
  await sql()`insert into public.revision_proposals(id,owner_id,project_id,section_id,session_id,before_text,instruction,base_section_version)
    values(${id},${cfg.LOCAL_OWNER_ID},${run.project_id},${section.id},${run.session_id},${section.markdown},${instruction},${section.version})`;
  const response = await client.webhook('revise-srs', cfg.N8N_WEBHOOK_SECRET, {
    session_id: run.session_id,
    revision_id: id,
    target_section: target,
    current_section_text: section.markdown,
    user_instructions: instruction,
    base_section_version: section.version,
  });
  assert.equal(response.status, 202);
  return id;
}
async function revised(id: string) {
  return until(
    async () => {
      const [r] = await sql()<
        {
          status: string;
          after_text: string;
          before_text: string;
          refined_query: string;
          metrics: Record<string, unknown>;
          error_code: string;
        }[]
      >`select status,after_text,before_text,refined_query,metrics,error_code from public.revision_proposals where id=${id}`;
      return r!;
    },
    (r) => r.status !== 'generating',
  );
}
let generationConfig: Record<string, unknown> = {};
async function configure(overrides: Record<string, unknown> = {}) {
  const value = { ...generationConfig, request_timeout_ms: 5000, ...overrides };
  await sql()`update public.app_config set value=${JSON.stringify(value)}::text::jsonb where key='generation'`;
}
async function runCase(name: string, fn: () => Promise<void>) {
  const selected = process.env.B5_CASES?.split(',');
  if (selected && !selected.includes(name)) return;
  await readyMock();
  await mock('reset');
  await configure();
  const start = Date.now();
  try {
    await fn();
    results.push({ name, ms: Date.now() - start, passed: true });
    console.log(`PASS ${name} (${((Date.now() - start) / 1000).toFixed(1)}s)`);
  } catch (error) {
    results.push({ name, ms: Date.now() - start, passed: false });
    throw error;
  }
}
let happy: Run;
async function main() {
  assert.ok(control, 'Mock control token is missing');
  await readyMock();
  const [config] = await sql()<
    { value: Record<string, unknown> }[]
  >`select value from public.app_config where key='generation'`;
  generationConfig = config!.value;
  await runCase('reapply-recovery', async () => {
    const deployed = await deployProduction();
    const before = await Promise.all(
      Object.values(deployed).map((id) => client.request<Workflow>(`workflows/${id}`)),
    );
    const layout = (workflow: Workflow) =>
      JSON.stringify({
        id: workflow.id,
        nodes: workflow.nodes.map((node) => ({
          id: node.id,
          position: node.position,
        })),
        groups: workflow.nodeGroups,
        mcp: workflow.settings.availableInMCP,
      });
    try {
      for (const id of Object.values(deployed))
        await client.request(`workflows/${id}/deactivate`, 'POST');
      await reapplyIntegrations(cfg.LOCAL_OWNER_ID);
      for (const prior of before) {
        const restored = await client.request<Workflow>(`workflows/${prior.id}`);
        assert.equal(restored.active, true);
        assert.equal(layout(restored), layout(prior));
      }
    } finally {
      await deployProduction();
    }
  });
  await runCase('supabase-smoke', async () => {
    const response = await client.webhook('naskah-smoke-supabase', cfg.N8N_WEBHOOK_SECRET, {});
    assert.equal(response.status, 200);
    assert.equal((response.data as { ok: boolean }).ok, true);
  });
  await runCase('generation', async () => {
    happy = await seed('generation');
    await start(happy);
    const result = await terminal(happy);
    assert.equal(
      result.status,
      'completed',
      `Generation failed: ${result.error_code}/${result.current_stage}`,
    );
    assert.equal(result.completed_sections.length, 15);
    const stored = await sections(happy);
    assert.ok(
      stored.every(
        (section) =>
          Array.isArray(section.requirements) &&
          typeof section.guardrail === 'object' &&
          section.guardrail !== null,
      ),
    );
    const [event] = await sql()<
      { payload: { document: { sections: Section[] } } }[]
    >`select payload from public.generation_events where session_id=${happy.session_id} and type='completed'`;
    assert.ok(event);
    const markdown = renderDocumentSections(event.payload.document.sections);
    assert.equal(digest(markdown), String(result.metrics.markdown_sha256));
    assert.ok(Number(result.metrics.tokens_in) > 0);
    assert.equal(Number(result.metrics.structure_completeness_pct), 100);
    const [retrieval] = await sql()<
      { n: number }[]
    >`select count(*)::int as n from public.retrieved_chunk_log where session_id=${happy.session_id}`;
    assert.ok(retrieval!.n > 0);
    const requests = await captures();
    assert.deepEqual(
      [...new Set(requests.filter((r) => r.kind === 'chapter').map((r) => r.number))],
      ['1', '2', '3', '4'],
    );
  });
  await runCase('revision-isolation', async () => {
    if (!happy) {
      happy = await seed('revision-base');
      await start(happy);
      assert.equal((await terminal(happy)).status, 'completed');
    }
    const before = await sections(happy),
      id = await revision(happy, '3.2', 'Tambahkan audit akses pada kebutuhan target.');
    assert.equal((await revised(id)).status, 'pending');
    assert.deepEqual(await sections(happy), before);
    await sql()`select public.accept_revision(${cfg.LOCAL_OWNER_ID}::uuid,${id}::uuid)`;
    const after = await sections(happy);
    assert.equal(
      after.find((s) => s.section_id === '3.2')!.version,
      before.find((s) => s.section_id === '3.2')!.version + 1,
    );
    assert.deepEqual(
      after.filter((s) => s.section_id !== '3.2'),
      before.filter((s) => s.section_id !== '3.2'),
    );
    const stable = await sections(happy),
      ids = await Promise.all([
        revision(happy, '1.1', 'Tambahkan kebutuhan audit lokal.'),
        revision(happy, '1.2', 'Tambahkan batas cakupan proyek.'),
      ]);
    const proposals = await Promise.all(ids.map(revised));
    assert.ok(proposals.every((r) => r.status === 'pending'));
    assert.deepEqual(await sections(happy), stable);
    for (const proposal of ids)
      await sql()`update public.revision_proposals set status='rejected' where id=${proposal}`;
  });
  await runCase('invalid-input-and-auth', async () => {
    const url = cfg.N8N_BASE_URL + '/webhook/generate-srs';
    const invalid = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Naskah-Token': cfg.N8N_WEBHOOK_SECRET,
      },
      body: JSON.stringify({ session_id: 'bad', raw_text: 'not echoed' }),
    });
    assert.equal(invalid.status, 400);
    assert.ok(!(await invalid.text()).includes('not echoed'));
    const denied = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    assert.ok([401, 403].includes(denied.status));
  });
  await runCase('json-repair', async () => {
    await mock('scenario', {
      rules: [{ kind: 'chapter', number: '2', failure: 'malformed', times: 1 }],
    });
    const run = await seed('repair');
    await start(run);
    const result = await terminal(run);
    assert.equal(result.status, 'completed');
    assert.equal(result.metrics.repairs, 1);
    assert.ok((await captures()).some((r) => r.kind === 'chapter' && r.number === '2' && r.repair));
  });
  for (const [name, failure, code] of [
    ['invalid-schema', 'schema-invalid', 'llm_invalid_output'],
    ['empty-content', 'empty', 'llm_invalid_output'],
    ['unauthorized', '401', 'llm_unauthorized'],
    ['rate-limit', '429', 'llm_rate_limited'],
    ['server-error', '500', 'unknown'],
    ['timeout', 'timeout', 'llm_timeout'],
  ] as const)
    await runCase(name, async () => {
      if (failure === 'timeout') await configure({ request_timeout_ms: 350 });
      await mock('scenario', {
        rules: [{ kind: 'chapter', number: '2', failure }],
      });
      const run = await seed(name);
      await start(run);
      const result = await terminal(run);
      assert.equal(result.status, 'failed');
      assert.equal(result.error_code, code);
      assert.equal(result.completed_sections.length, 4);
      const [event] = await sql()<
        { n: number }[]
      >`select count(*)::int as n from public.generation_events where session_id=${run.session_id} and workflow_key=${result.n8n_execution_id + ':failed'}`;
      assert.equal(event!.n, 1, 'Error Trigger did not persist its failure event');
      if (failure === '429' || failure === '500' || failure === 'timeout')
        assert.equal(
          (await captures()).filter((r) => r.kind === 'chapter' && r.number === '2').length,
          3,
        );
      if (failure === '401') {
        const checkpoint = JSON.stringify(result.completed_sections);
        const newRun = randomUUID();
        run.run_id = newRun;
        await mock('reset');
        await sql()`update public.srs_generation_logs set status='queued',run_id=${newRun},n8n_execution_id=null,callback_event_id=null,error_code=null,finished_at=null where session_id=${run.session_id}`;
        await start(run, { from_part: 2 });
        const resumed = await terminal(run);
        assert.equal(resumed.status, 'completed');
        assert.equal(JSON.stringify(resumed.completed_sections.slice(0, 4)), checkpoint);
        assert.ok(!(await captures()).some((r) => r.kind === 'chapter' && r.number === '1'));
      }
    });
  await runCase('guardrail-failure', async () => {
    await mock('scenario', {
      rules: [{ kind: 'guardrail', number: '2', failure: 'schema-invalid' }],
    });
    const run = await seed('guardrail-failure');
    await start(run);
    const result = await terminal(run);
    assert.equal(result.status, 'failed');
    assert.equal(result.error_code, 'guardrail_failed');
    assert.equal(result.completed_sections.length, 4);
    assert.equal(
      (await captures()).filter((request) => request.kind === 'guardrail' && request.number === '2')
        .length,
      2,
    );
  });
  await runCase('retry-after-recovery', async () => {
    await mock('scenario', {
      rules: [
        {
          kind: 'chapter',
          number: '1',
          failure: '429',
          times: 1,
          retry_after: 1,
        },
        { kind: 'chapter', number: '2', failure: '500', times: 1 },
      ],
    });
    const run = await seed('retry-recovery');
    await start(run);
    const result = await terminal(run);
    assert.equal(result.status, 'completed');
    const llmRetries = (
      result.metrics.retry_events as { channel: string; status: number }[]
    ).filter((event) => event.channel === 'llm');
    assert.deepEqual(
      llmRetries.map((event) => event.status),
      [429, 500],
    );
    assert.ok(Number(result.metrics.retry_count) >= llmRetries.length);
    const attempts = (await captures()).filter((r) => r.kind === 'chapter' && r.number === '1');
    assert.equal(attempts.length, 2);
    assert.ok(Date.parse(String(attempts[1]!.at)) - Date.parse(String(attempts[0]!.at)) >= 950);
  });
  await runCase('embedding-dimension', async () => {
    await mock('scenario', {
      rules: [{ path: '/embeddings', failure: 'dimension', times: 1 }],
    });
    const run = await seed('dimension');
    await start(run);
    assert.equal((await terminal(run)).error_code, 'embedding_dimension_mismatch');
  });
  await runCase('guardrail-assumptions-and-ids', async () => {
    await mock('scenario', {
      rules: [
        {
          kind: 'guardrail',
          number: '3',
          failure: 'guardrail-assumption',
          times: 1,
        },
        { kind: 'guardrail', number: '4', failure: 'unsafe-rewrite', times: 1 },
      ],
    });
    const run = await seed('guardrail');
    await start(run);
    const result = await terminal(run);
    assert.equal(result.status, 'completed');
    const all = result.completed_sections.flatMap((s) => s.guardrail.rewrites);
    assert.ok(all.some((r) => r.needs_confirmation && !r.resolved));
    assert.ok(Number(result.metrics.ignored_rewrites) > 0);
    assert.equal(
      result.completed_sections.flatMap((s) => s.requirements).find((r) => r.id === 'REQ-F-01')?.id,
      'REQ-F-01',
    );
  });
  await runCase('long-input-condensing', async () => {
    await configure({ input_token_budget: 512 });
    const run = await seed(
      'summary',
      Array(60)
        .fill('Petugas harus menyimpan dan memverifikasi data pasien sebelum proses audit.')
        .join('\n'),
    );
    await start(run);
    const result = await terminal(run);
    assert.equal(result.status, 'completed');
    assert.equal(result.metrics.condensed, true);
    assert.ok((await captures()).filter((r) => r.kind === 'summary').length > 1);
  });
  await runCase('cancel-before-start', async () => {
    const run = await seed('cancel-early');
    await sql()`update public.srs_generation_logs set cancel_requested=true where session_id=${run.session_id}`;
    await start(run);
    assert.equal((await terminal(run)).status, 'cancelled');
    assert.equal((await captures()).length, 0);
  });
  await runCase('cancel-during-run', async () => {
    await mock('scenario', {
      rules: [{ kind: 'chapter', number: '2', failure: 'slow', delay_ms: 1800 }],
    });
    const run = await seed('cancel-mid');
    await start(run);
    await until(
      async () => {
        const [r] = await sql()<
          { n: number }[]
        >`select count(*)::int as n from public.generation_events where session_id=${run.session_id} and type='section_started' and payload->>'sectionId'='2.1'`;
        return r!.n;
      },
      (n) => n > 0,
    );
    await sql()`update public.srs_generation_logs set cancel_requested=true where session_id=${run.session_id}`;
    const result = await terminal(run);
    assert.equal(result.status, 'cancelled');
    assert.ok(result.completed_sections.length >= 4);
    assert.ok(
      !(await captures()).some(
        (r) => r.kind === 'chapter' && ['3', '4'].includes(String(r.number)),
      ),
    );
  });
  await runCase('refinement-fallback', async () => {
    const base = await seed('refine-base');
    await start(base);
    assert.equal((await terminal(base)).status, 'completed');
    await mock('scenario', { rules: [{ kind: 'refine', failure: '500' }] });
    const id = await revision(base, '3.2', 'Tambahkan kebutuhan audit.');
    const result = await revised(id);
    assert.equal(result.status, 'pending');
    assert.equal(result.metrics.refinement_fallback, true);
    await sql()`update public.revision_proposals set status='rejected' where id=${id}`;
  });
  await runCase('empty-knowledge-base', async () => {
    const owner = await isolatedOwner();
    const run = await seed('empty-kb', undefined, owner);
    await start(run);
    assert.equal((await terminal(run)).error_code, 'knowledge_base_empty');
  });
  await runCase('embedding-model-mismatch', async () => {
    const owner = await isolatedOwner('naskah-test-model');
    await chunk(owner, Array(1536).fill(0.1));
    const run = await seed('model-mismatch', undefined, owner);
    await start(run);
    assert.equal((await terminal(run)).error_code, 'embedding_model_mismatch');
  });
  await runCase('owner-scoped-retrieval', async () => {
    const run = await seed('owner-isolation'),
      owner = randomUUID();
    const key = decryptSecret((await readSecret(cfg.LOCAL_OWNER_ID, 'embeddings'))!);
    const response = await fetch('http://127.0.0.1:4010/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        dimensions: 1536,
        input: retrievalQuery(run.project_title, run.domain, run.raw_text, 8000),
      }),
    });
    const vector = ((await response.json()) as { data: { embedding: number[] }[] }).data[0]!
      .embedding;
    const doc = await chunk(owner, vector);
    await start(run);
    const result = await terminal(run);
    assert.equal(result.status, 'completed');
    const [leak] = await sql()<
      { n: number }[]
    >`select count(*)::int as n from public.retrieved_chunk_log where session_id=${run.session_id} and provenance->>'doc_id'=${doc}`;
    assert.equal(leak!.n, 0);
  });
  await runCase('revision-invalid-output', async () => {
    const base = await seed('revision-failure-base');
    await start(base);
    assert.equal((await terminal(base)).status, 'completed');
    const before = await sections(base);
    await mock('scenario', {
      rules: [{ kind: 'revision', failure: 'revision-drop-id' }],
    });
    const id = await revision(base, '3.2', 'Tambahkan audit tanpa mengganti ID.');
    const result = await revised(id);
    assert.equal(result.status, 'failed');
    assert.equal(result.error_code, 'llm_invalid_output');
    assert.deepEqual(await sections(base), before);
  });
  await runCase('callback-retry-and-resume', async () => {
    try {
      await deployProduction('http://host.docker.internal:4010');
      const run = await seed('callback-failure');
      await start(run);
      const result = await terminal(run, false);
      assert.equal(result.status, 'failed');
      assert.equal(result.error_code, 'callback_failed');
      assert.equal(result.completed_sections.length, 15);
      assert.equal((await captures()).filter((r) => r.kind === 'callback').length, 5);
      await deployProduction();
      const next = randomUUID();
      run.run_id = next;
      await sql()`update public.srs_generation_logs set status='queued',run_id=${next},n8n_execution_id=null,callback_event_id=null,error_code=null,finished_at=null where session_id=${run.session_id}`;
      await mock('reset');
      await start(run, { from_part: 5 });
      assert.equal((await terminal(run)).status, 'completed');
      assert.ok(!(await captures()).some((r) => r.kind === 'chapter'));
    } finally {
      await deployProduction();
    }
  });
  await runCase('callback-idempotency', async () => {
    if (!happy) {
      happy = await seed('callback-source');
      await start(happy);
      assert.equal((await terminal(happy)).status, 'completed');
    }
    const run = await seed('callback-replay'),
      execution = 'b5-callback-' + randomUUID();
    const [ctx] = await sql()<
      { context: { callback_event_id: string } }[]
    >`select public.naskah_workflow_context(${run.session_id}::uuid,${execution},${run.run_id}::uuid,null) as context`;
    const source = (await row(happy)).completed_sections;
    const payload = {
      event_id: ctx!.context.callback_event_id,
      session_id: run.session_id,
      run_id: run.run_id,
      sent_at: new Date().toISOString(),
      execution_id: execution,
      document: {
        projectId: run.project_id,
        templateId: 'ieee-830-1998',
        sections: source,
        chunks: [],
        metadata: {
          title: run.project_title,
          domain: run.domain,
          createdAt: new Date().toISOString(),
          generationSeconds: 0,
        },
      },
      markdown: renderDocumentSections(source),
      metrics: { model: 'mock', embedding_model: 'text-embedding-3-small' },
    };
    const send = (body: unknown) =>
      fetch(cfg.APP_BASE_URL + '/api/webhooks/srs-ready', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cfg.N8N_CALLBACK_SECRET}`,
        },
        body: JSON.stringify(body),
      });
    assert.equal((await send(payload)).status, 200);
    const duplicate = await send(payload);
    assert.equal(duplicate.status, 200);
    assert.equal(((await duplicate.json()) as { duplicate: boolean }).duplicate, true);
    const [count] = await sql()<
      { n: number }[]
    >`select count(*)::int as n from public.callback_receipts where session_id=${run.session_id}`;
    assert.equal(count!.n, 1);
    assert.equal((await send({ ...payload, markdown: payload.markdown + ' changed' })).status, 409);
    assert.equal((await send({ ...payload, sent_at: '2000-01-01T00:00:00.000Z' })).status, 401);
  });
  const safe = JSON.stringify({ results, requests: await captures() });
  for (const secret of secrets) assert.ok(!safe.includes(secret), 'Secret leaked into evidence');
  console.log(`B5 real-webhook acceptance: ${results.length} cases passed.`);
}
main()
  .catch(async (error: unknown) => {
    let message = error instanceof Error ? error.message : 'b5_test_failed';
    for (const secret of secrets) if (secret) message = message.replaceAll(secret, '[REDACTED]');
    console.error(message.slice(0, 1400));
    for (const run of created.slice(-1)) {
      const value = await row(run);
      console.error(
        JSON.stringify({
          session_id: run.session_id,
          status: value.status,
          stage: value.current_stage,
          code: value.error_code,
          checkpointSections: value.completed_sections.length,
        }),
      );
    }
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await mkdir('artifacts', { recursive: true });
      await writeFile('artifacts/b5-last-requests.json', JSON.stringify(await captures(), null, 2));
      await mock('reset');
      for (const item of temporaryChunks)
        await sql()`delete from public.srs_knowledge_base where owner_id=${item.owner} and doc_id=${item.doc}`;
      for (const owner of temporaryOwners) {
        await sql()`delete from public.projects where owner_id=${owner}`;
        await sql()`delete from public.integration_secrets where owner_id=${owner}`;
        await sql()`delete from public.audit_log where owner_id=${owner}`;
      }
      if (Object.keys(generationConfig).length)
        await sql()`update public.app_config set value=${JSON.stringify(generationConfig)}::text::jsonb where key='generation'`;
      await mkdir('artifacts', { recursive: true });
      await writeFile(
        'artifacts/b5-acceptance.json',
        JSON.stringify(
          {
            at: new Date().toISOString(),
            passed: process.exitCode !== 1,
            cases: results,
            syntheticProjects: created.map((r) => ({
              session_id: r.session_id,
              project_id: r.project_id,
            })),
            mockOnly: true,
            inspectedExecutions,
          },
          null,
          2,
        ),
      );
    } finally {
      await sql().end();
    }
  });
