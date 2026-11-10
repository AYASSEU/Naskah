import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHttpServices } from '../apps/web/src/services/http';
import { exercisePorts, terminal } from '../tests/port-conformance';
import { env } from '../apps/web/src/server/config/env.server';
import { sql } from '../apps/web/src/server/db/client';
import {
  readSecret,
  decryptSecret,
  markIntegration,
} from '../apps/web/src/server/integrations/store';
import type { Project, Section } from '../packages/contracts/src/index';
const cfg = env(),
  base = 'http://127.0.0.1:3000',
  nativeFetch = globalThis.fetch.bind(globalThis);
const control = process.env.MOCK_CONTROL_TOKEN;
let cookie = '',
  dropNextStream = true,
  dropped = false,
  reconnected = false;
const network: { path: string; status: number; cursor?: string }[] = [];
const results: { name: string; ms: number; passed: boolean }[] = [];
const created: Project[] = [];
let completedProject: Project;
const services = createHttpServices();
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const hash = (text: string) => createHash('sha256').update(text).digest('hex');
globalThis.fetch = async (input, init) => {
  if (typeof input !== 'string' || !input.startsWith('/')) return nativeFetch(input, init);
  assert.ok(input.startsWith('/api/'), 'Browser adapter attempted a non-API destination');
  const headers = new Headers(init?.headers);
  if (cookie) headers.set('Cookie', cookie);
  if (init?.method && init.method !== 'GET') headers.set('Origin', base);
  const response = await nativeFetch(base + input, { ...init, headers });
  const session = response.headers.get('set-cookie');
  if (session) cookie = session.split(';')[0]!;
  network.push({
    path: input,
    status: response.status,
    ...(input.includes('/events') ? { cursor: headers.get('Last-Event-ID') ?? '0' } : {}),
  });
  if (input.includes('/events') && Number(headers.get('Last-Event-ID')) > 0 && dropped)
    reconnected = true;
  if (dropNextStream && input.includes('/events') && response.ok && response.body) {
    dropNextStream = false;
    dropped = true;
    const reader = response.body.getReader();
    return new Response(
      new ReadableStream({
        async start(controller) {
          const decoder = new TextDecoder();
          let pending = '';
          try {
            while (true) {
              const next = await reader.read();
              if (next.done) break;
              pending += decoder.decode(next.value, { stream: true });
              const end = pending.indexOf('\n\n');
              if (end >= 0) {
                controller.enqueue(new TextEncoder().encode(pending.slice(0, end + 2)));
                break;
              }
            }
            controller.close();
          } finally {
            await reader.cancel().catch(() => {});
          }
        },
      }),
      { status: response.status, headers: response.headers },
    );
  }
  return response;
};
async function mock(command: string, data: unknown = {}) {
  const response = await nativeFetch(`http://127.0.0.1:4010/__test/${command}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${control}` },
    body: JSON.stringify(data),
  });
  assert.equal(response.status, 200, 'mock_control_failed');
  return response.json();
}
async function captures() {
  return ((await mock('requests')) as { requests: Record<string, unknown>[] }).requests;
}
async function api(
  path: string,
  method = 'GET',
  body?: unknown,
  headers: Record<string, string> = {},
) {
  return globalThis.fetch(path, {
    method,
    headers: {
      'X-Naskah-Client': 'web',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
async function until<T>(read: () => Promise<T>, accept: (value: T) => boolean, limit = 30000) {
  const end = Date.now() + limit;
  do {
    const value = await read();
    if (accept(value)) return value;
    await pause(150);
  } while (Date.now() < end);
  throw new Error('b6_condition_timeout');
}
async function project(label: string) {
  const p = await services.projects.create({
    title: 'B6 synthetic ' + label,
    domain: 'Healthcare',
    version: '0.1',
    status: 'generating',
    rawText: 'Petugas harus menyimpan data pasien dan catatan audit lokal.',
  });
  created.push(p);
  return p;
}
const input = (p: Project) => ({
  session_id: p.sessionId,
  project_title: p.title,
  domain: p.domain,
  raw_text: p.rawText,
});
async function run(name: string, action: () => Promise<void>) {
  await mock('reset');
  const started = Date.now();
  try {
    await action();
    results.push({ name, ms: Date.now() - started, passed: true });
    console.log('PASS ' + name);
  } catch (error) {
    results.push({ name, ms: Date.now() - started, passed: false });
    throw error;
  }
}
async function main() {
  assert.ok(control, 'mock_control_missing');
  for (const provider of ['deepseek', 'embeddings']) {
    const row = await readSecret(cfg.LOCAL_OWNER_ID, provider);
    assert.ok(row);
    const url = new URL((row.config as { baseUrl: string }).baseUrl);
    assert.ok(
      ['localhost', '127.0.0.1', 'host.docker.internal'].includes(url.hostname) &&
        url.port === '4010',
      'Refusing non-mock provider',
    );
    assert.ok(decryptSecret(row).startsWith('naskah-test-'), 'Refusing a real provider key');
  }
  await run('same-port-conformance-http-and-SSE-reconnect', async () => {
    const result = await exercisePorts(services);
    assert.equal(result.revisionIsolation, true);
    assert.ok(dropped && reconnected);
  });
  await run('owner-and-origin-boundaries', async () => {
    const denied = await nativeFetch(base + '/api/projects');
    assert.equal(denied.status, 401);
    const cross = await nativeFetch(base + '/api/projects', {
      method: 'POST',
      headers: {
        Cookie: cookie,
        Origin: 'https://untrusted.test',
        'Content-Type': 'application/json',
      },
      body: '{}',
    });
    assert.equal(cross.status, 403);
    const foreign = randomUUID(),
      owner = randomUUID(),
      session = randomUUID();
    await sql()`insert into public.projects(id,owner_id,session_id,title,domain) values(${foreign},${owner},${session},'B6 foreign synthetic','Healthcare')`;
    try {
      assert.equal((await api('/api/projects/' + foreign)).status, 404);
      assert.equal((await api('/api/documents/' + foreign)).status, 404);
    } finally {
      await sql()`delete from public.projects where id=${foreign} and owner_id=${owner}`;
    }
    const invalid = await api('/api/generations', 'POST', {
      session_id: 'bad',
      raw_text: 'private-invalid-marker',
    });
    assert.equal(invalid.status, 400);
    assert.ok(!(await invalid.text()).includes('private-invalid-marker'));
  });
  await run('legacy-project-checkpoint-recovery', async () => {
    const legacyId = randomUUID(),
      session = randomUUID(),
      now = new Date().toISOString();
    const checkpoint = {
      id: '1.1',
      number: '1.1',
      title: 'Purpose (Tujuan)',
      markdown: 'Legacy checkpoint must remain intact.',
      status: 'drafted',
      source: 'ai',
      requirements: [],
      guardrail: { dimensions: [], rewrites: [] },
      updatedAt: now,
      version: 1,
      locked: false,
    };
    await sql()`insert into public.projects(id,owner_id,session_id,title,domain,status,raw_text) values(${legacyId},${cfg.LOCAL_OWNER_ID},${session},'B6 synthetic legacy recovery','Healthcare','failed','Synthetic legacy input.')`;
    const legacy = await services.projects.get(legacyId);
    created.push(legacy);
    await sql()`insert into public.srs_generation_logs(session_id,owner_id,project_id,project_title,domain,status,completed_sections) values(${session},${cfg.LOCAL_OWNER_ID},${legacyId},${legacy.title},${legacy.domain},'failed',${JSON.stringify([checkpoint])}::text::jsonb)`;
    const recovered = await services.documents.getDocument(legacyId);
    assert.equal(recovered.sections.length, 15);
    assert.equal(recovered.sections[0]!.markdown, checkpoint.markdown);
    assert.equal(recovered.sections.filter((section) => section.status === 'pending').length, 14);
    const [persisted] = await sql()<
      { n: number }[]
    >`select count(*)::int as n from public.documents where project_id=${legacyId} and owner_id=${cfg.LOCAL_OWNER_ID}`;
    assert.equal(persisted!.n, 1);
    assert.equal((await captures()).length, 0);
  });
  await run('optimistic-save-lock-and-history', async () => {
    const p = await project('optimistic writes'),
      doc = await services.documents.getDocument(p.id),
      section = doc.sections[0]!;
    const write = (suffix: string) =>
      api(
        '/api/sections/' + section.id,
        'PUT',
        {
          projectId: p.id,
          section: { ...section, markdown: suffix, status: 'edited', source: 'human' },
        },
        { 'If-Match': String(section.version) },
      );
    const pair = await Promise.all([write('First local edit.'), write('Second local edit.')]);
    assert.deepEqual(pair.map((r) => r.status).sort(), [200, 409]);
    const conflict = (await pair.find((r) => r.status === 409)!.json()) as {
      code: string;
      detail: { current: Section };
    };
    assert.equal(conflict.code, 'section_changed');
    assert.equal(conflict.detail.current.version, 2);
    const current = await services.documents.getDocument(p.id),
      target = current.sections[0]!;
    assert.deepEqual(current.sections.slice(1), doc.sections.slice(1));
    const history = await api(`/api/sections/${target.id}/versions?projectId=${p.id}`);
    assert.equal(history.status, 200);
    assert.equal(((await history.json()) as unknown[]).length, 1);
    await services.documents.saveSection(p.id, { ...target, status: 'locked' });
    const locked = (await services.documents.getDocument(p.id)).sections[0]!;
    await assert.rejects(
      () =>
        services.documents.saveSection(p.id, {
          ...locked,
          markdown: locked.markdown + ' forbidden',
          status: 'edited',
        }),
      { code: 'section_locked' },
    );
    await services.documents.saveSection(p.id, { ...locked, status: 'drafted' });
    assert.equal((await services.documents.getDocument(p.id)).sections[0]!.locked, false);
  });
  await run('readiness-blocks-before-dispatch', async () => {
    const p = await project('blocked');
    try {
      await markIntegration(cfg.LOCAL_OWNER_ID, 'deepseek', 'stored');
      const response = await api('/api/generations', 'POST', input(p));
      assert.equal(response.status, 409);
      const [count] = await sql()<
        { n: number }[]
      >`select count(*)::int as n from public.srs_generation_logs where session_id=${p.sessionId}`;
      assert.equal(count!.n, 0);
      assert.equal((await captures()).length, 0);
    } finally {
      await markIntegration(cfg.LOCAL_OWNER_ID, 'deepseek', 'ready');
    }
  });
  await run('duplicate-start-is-one-run', async () => {
    const p = await project('duplicate dispatch');
    completedProject = p;
    const pair = await Promise.all([
      api('/api/generations', 'POST', input(p)),
      api('/api/generations', 'POST', input(p)),
    ]);
    assert.ok(pair.every((r) => r.status === 202));
    const accepted = (await Promise.all(pair.map((r) => r.json()))) as { run_id: string }[];
    assert.equal(accepted[0]!.run_id, accepted[1]!.run_id);
    const handle = services.generation.start(input(p));
    assert.equal((await terminal(handle)).type, 'completed');
    assert.equal(
      (await captures()).filter((r) => r.kind === 'chapter' && r.number === '1').length,
      1,
    );
  });
  await run('concurrent-revisions-and-stale-proposal', async () => {
    const p = completedProject,
      before = await services.documents.getDocument(p.id);
    const proposals = await Promise.all(
      ['1.1', '1.2'].map((target) => {
        const section = before.sections.find((s) => s.id === target)!;
        return services.revision.requestRevision({
          session_id: p.sessionId,
          target_section: target,
          current_section_text: section.markdown,
          user_instructions: 'Tambahkan catatan audit pada bagian ' + target,
          base_section_version: section.version,
        });
      }),
    );
    assert.equal((await services.revision.listPending!(p.id)).length, 2);
    const first = before.sections.find((s) => s.id === '1.1')!;
    await services.documents.saveSection(p.id, {
      ...first,
      markdown: first.markdown + '\n\nEdit setelah usulan.',
      status: 'edited',
      source: 'human',
    });
    await assert.rejects(() => services.revision.acceptRevision!(proposals[0]!.id), {
      code: 'section_changed',
    });
    await services.revision.rejectRevision!(proposals[0]!.id);
    const edited = await services.documents.getDocument(p.id);
    await services.revision.acceptRevision!(proposals[1]!.id);
    const after = await services.documents.getDocument(p.id);
    assert.deepEqual(
      after.sections.filter((s) => s.id !== '1.2'),
      edited.sections.filter((s) => s.id !== '1.2'),
    );
    assert.equal((await services.revision.listPending!(p.id)).length, 0);
  });
  await run('provider-failure-and-checkpoint-resume', async () => {
    await mock('scenario', { rules: [{ kind: 'chapter', number: '2', failure: '401' }] });
    const p = await project('resume'),
      failed = await terminal(services.generation.start(input(p)));
    assert.equal(failed.type, 'failed');
    if (failed.type === 'failed') assert.equal(failed.error.code, 'llm_unauthorized');
    const before = await services.documents.getDocument(p.id);
    assert.ok(before.sections.filter((s) => s.status === 'drafted').length === 4);
    const first = before.sections.find((s) => s.id === '1.1')!;
    await services.documents.saveSection(p.id, {
      ...first,
      markdown: first.markdown + '\n\nCatatan manusia sebelum resume.',
      source: 'human',
      status: 'edited',
    });
    const edited = await services.documents.getDocument(p.id),
      checkpoint = hash(
        edited.sections
          .filter((s) => s.number.startsWith('1.'))
          .map((s) => s.markdown)
          .join('\n'),
      );
    await mock('reset');
    await services.generation.resume!(input(p));
    assert.equal((await terminal(services.generation.start(input(p)))).type, 'completed');
    const after = await services.documents.getDocument(p.id);
    assert.equal(
      hash(
        after.sections
          .filter((s) => s.number.startsWith('1.'))
          .map((s) => s.markdown)
          .join('\n'),
      ),
      checkpoint,
    );
    assert.equal(after.sections.find((s) => s.id === '1.1')!.source, 'human');
    assert.ok(!(await captures()).some((r) => r.kind === 'chapter' && r.number === '1'));
  });
  await run('cancel-persists-and-ends-stream', async () => {
    await mock('scenario', {
      rules: [{ kind: 'chapter', number: '1', failure: 'slow', delay_ms: 2000 }],
    });
    const p = await project('cancel'),
      handle = services.generation.start(input(p));
    await until(captures, (requests) => requests.some((r) => r.kind === 'chapter'));
    const done = terminal(handle);
    handle.cancel();
    const event = await done;
    assert.equal(event.type, 'failed');
    if (event.type === 'failed') assert.equal(event.error.code, 'cancelled');
    assert.equal((await services.projects.get(p.id)).status, 'failed');
  });
  await run('watchdog-preserves-timeout-against-late-callback', async () => {
    await mock('scenario', {
      rules: [{ kind: 'chapter', number: '2', failure: 'slow', delay_ms: 4000 }],
    });
    const p = await project('watchdog'),
      handle = services.generation.start(input(p));
    await until(captures, (requests) =>
      requests.some((r) => r.kind === 'chapter' && r.number === '2'),
    );
    await sql()`update public.srs_generation_logs set updated_at=now()-interval '5 minutes' where session_id=${p.sessionId}`;
    const event = await terminal(handle);
    assert.equal(event.type, 'failed');
    if (event.type === 'failed') assert.equal(event.error.code, 'timeout');
    await pause(4500);
    const [row] = await sql()<
      { status: string; error_code: string; completed_sections: Section[] }[]
    >`select status,error_code,completed_sections from public.srs_generation_logs where session_id=${p.sessionId}`;
    assert.equal(row!.status, 'failed');
    assert.equal(row!.error_code, 'timeout');
    assert.equal(row!.completed_sections.length, 4);
  });
  assert.ok(network.every((r) => r.path.startsWith('/api/')));
  console.log(`B6 local HTTP acceptance: ${results.length} cases passed.`);
}
main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message.slice(0, 1000) : 'b6_failed');
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await mock('reset');
      await markIntegration(cfg.LOCAL_OWNER_ID, 'deepseek', 'ready');
      for (const p of created) await services.projects.delete(p.id).catch(() => {});
      await mkdir('artifacts', { recursive: true });
      await writeFile(
        'artifacts/b6-acceptance.json',
        JSON.stringify(
          {
            at: new Date().toISOString(),
            passed: process.exitCode !== 1,
            mockOnly: true,
            cases: results,
            network,
            stream: { dropped, reconnected },
          },
          null,
          2,
        ),
      );
    } finally {
      globalThis.fetch = nativeFetch;
      await sql().end();
    }
  });
