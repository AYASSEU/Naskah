import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
process.loadEnvFile('apps/web/.env.local');
mkdirSync('artifacts/b7', { recursive: true });
const { cleanPages } = await import(
  pathToFileURL(resolve('apps/web/src/entities/document/cleaning.ts'))
);
const base = 'http://127.0.0.1:3000',
  service = 'http://127.0.0.1:8000';
const fixtures = resolve('tests/fixtures/documents');
const results = [];
let cookie = '',
  projectId;
async function check(name, fn) {
  const start = Date.now();
  await fn();
  results.push({ name, ms: Date.now() - start, passed: true });
  console.log('PASS ' + name);
}
async function api(path, method = 'GET', body, headers = {}) {
  const response = await fetch(base + path, {
    method,
    headers: {
      'X-Naskah-Client': 'web',
      Cookie: cookie,
      ...(method === 'GET' ? {} : { Origin: base }),
      ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
  const session = response.headers.get('set-cookie');
  if (session) cookie = session.split(';')[0];
  return response;
}
async function value(response) {
  const data = await response.json();
  assert.ok(response.ok, JSON.stringify(data));
  return data;
}
async function upload(name, bytes = readFileSync(resolve(fixtures, name))) {
  const form = new FormData();
  form.set('file', new File([bytes], name));
  return api('/api/parse-pdf', 'POST', form);
}
async function internal(path, body) {
  return fetch(service + path, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + process.env.COMPILER_SERVICE_TOKEN,
      'Content-Type': path === '/parse' ? 'application/pdf' : 'application/json',
    },
    body,
  });
}
const raw = readFileSync(resolve(fixtures, 'text.pdf'));
try {
  await check('authentication and origin guards', async () => {
    assert.equal(
      (
        await fetch(base + '/api/compile-document', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
        })
      ).status,
      403,
    );
    assert.equal((await fetch(base + '/api/exports/' + randomUUID())).status, 401);
    assert.equal((await fetch(service + '/parse', { method: 'POST', body: raw })).status, 401);
    await value(await api('/api/auth/session'));
    assert.equal(
      (await api('/api/parse-pdf', 'POST', new FormData(), { Origin: 'http://example.invalid' }))
        .status,
      403,
    );
  });
  await check('TXT and multipage PDF share Phase 1 cleaning', async () => {
    const txt = await value(await upload('notes.txt'));
    assert.deepEqual(txt, {
      name: 'notes.txt',
      size: readFileSync(resolve(fixtures, 'notes.txt')).length,
      ...cleanPages([readFileSync(resolve(fixtures, 'notes.txt'), 'utf8')]),
    });
    const pages = await value(await internal('/parse', raw));
    const pdf = await value(await upload('text.pdf'));
    assert.deepEqual(pdf, { name: 'text.pdf', size: raw.length, ...cleanPages(pages.pages) });
    assert.equal(pdf.pages, 3);
    assert.ok(!pdf.text.includes('repeated header'));
    assert.ok(pdf.text.includes('Unique section 3'));
    writeFileSync('artifacts/b7/parsed.json', JSON.stringify({ txt, pdf }));
  });
  await check('parser limits, malformed, scanned, encrypted and UTF-8 errors', async () => {
    for (const [name, expected] of [
      ['scanned.pdf', 'no_text_layer'],
      ['encrypted.pdf', 'encrypted_pdf'],
      ['too-many-pages.pdf', 'page_limit'],
    ]) {
      const response = await upload(name);
      assert.equal((await response.json()).code, expected);
    }
    assert.equal(
      (await (await upload('invalid.pdf', Buffer.from('%PDF-broken'))).json()).code,
      'invalid_file',
    );
    assert.equal(
      (await (await upload('invalid.txt', Buffer.from([0xff, 0xfe, 0x61]))).json()).code,
      'invalid_encoding',
    );
    assert.equal((await upload('large.txt', Buffer.alloc(10 * 1024 * 1024 + 1))).status, 413);
  });
  await check('200-call parser soak reaches bounded memory plateau', async () => {
    // Fresh child process per call; sample only the persistent service after each batch.
    const samples = [];
    for (let i = 1; i <= 220; i++) {
      const response = await internal('/parse', raw);
      assert.equal(response.status, 200);
      const data = await response.json();
      assert.equal(data.pages.length, 3);
      if (i % 20 === 0) {
        const state = await (await fetch(service + '/health')).json();
        assert.equal(state.active, 0);
        samples.push({ call: i, rss: state.rss });
        console.log('parser soak ' + i + '/220');
      }
    }
    const measured = samples.filter((s) => s.call > 20),
      values = measured.map((s) => s.rss),
      range = Math.max(...values) - Math.min(...values);
    // Ignore 20 warm-up requests; a 16 MiB envelope bounds Node allocator noise.
    assert.ok(range < 16 * 1024 * 1024, 'persistent RSS grew beyond 16 MiB');
    assert.ok(
      measured.at(-1).rss - measured[0].rss < 8 * 1024 * 1024,
      'persistent RSS has an upward leak',
    );
    writeFileSync(
      'artifacts/b7/parser-soak.json',
      JSON.stringify({ warmup: 20, calls: 200, samples, range }, null, 2),
    );
  });
  await check('hospital DOCX/PDF snapshot, cache and private download', async () => {
    const project = await value(
      await api('/api/projects', 'POST', {
        title: 'B7 synthetic hospital',
        domain: 'Healthcare',
        version: '1.0',
        rawText: 'Synthetic acceptance fixture',
        status: 'draft_input',
      }),
    );
    projectId = project.id;
    const compile = () =>
      api('/api/compile-document', 'POST', {
        documentId: projectId,
        format: 'docx',
        author: 'Penguji Lokal',
        institution: 'Naskah',
      });
    assert.equal((await compile()).status, 409);
    const document = await value(await api('/api/documents/' + projectId));
    const markdown = readFileSync('tests/fixtures/markdown/phase1-1.md', 'utf8');
    const sections = document.sections.map((section) => {
      const expression = new RegExp(
        '^## ' +
          section.number.replaceAll('.', '\\.') +
          ' [^\\n]+\\n([\\s\\S]*?)(?=^#{1,2} |$(?![\\s\\S]))',
        'm',
      );
      const match = markdown.match(expression);
      assert.ok(match, 'fixture section ' + section.number);
      return {
        ...section,
        markdown: match[1].trim(),
        status: 'locked',
        source: 'human',
        locked: true,
      };
    });
    await value(
      await api('/api/documents/' + projectId + '/versions', 'POST', {
        sections,
        label: 'B7 hospital fixture',
      }),
    );
    await value(await api('/api/projects/' + projectId, 'PATCH', { status: 'finalized' }));
    const [docx, pdf] = await Promise.all([
      value(await compile()),
      value(
        await api('/api/compile-document', 'POST', {
          documentId: projectId,
          format: 'pdf',
          author: 'Penguji Lokal',
          institution: 'Naskah',
        }),
      ),
    ]);
    assert.equal(docx.mode, 'server');
    assert.ok(docx.url.startsWith('/api/exports/'));
    assert.equal(pdf.mode, 'server');
    assert.deepEqual(await value(await compile()), docx, 'snapshot must reuse export cache');
    for (const output of [docx, pdf]) {
      const response = await api(output.url);
      assert.equal(response.status, 200);
      assert.ok(response.headers.get('content-disposition').startsWith('attachment;'));
      assert.equal(response.headers.get('cache-control'), 'private, no-store');
      const bytes = Buffer.from(await response.arrayBuffer());
      assert.equal(bytes.length, output.size);
      assert.ok(bytes.length > 1000);
      writeFileSync('artifacts/b7/hospital.' + output.format, bytes);
      assert.equal((await fetch(base + output.url)).status, 401);
      const storage = await fetch(
        'http://127.0.0.1:54321/storage/v1/object/public/exports/' +
          process.env.LOCAL_OWNER_ID +
          '/' +
          projectId +
          '/missing.pdf',
      );
      assert.ok(!storage.ok);
    }
    writeFileSync('artifacts/b7/export.json', JSON.stringify({ docx, pdf }));
  });
  await check('unsupported image cannot trigger external fetch', async () => {
    const response = await internal(
      '/compile',
      JSON.stringify({
        markdown: '![external](http://127.0.0.1:4010/private)',
        metadata: {
          title: 'Test',
          project: 'Test',
          version: '1',
          author: '',
          institution: '',
          date: '2026-11-10',
        },
      }),
    );
    assert.equal(response.status, 422);
    assert.equal((await response.json()).error, 'unsafe_document');
  });
} finally {
  if (projectId) assert.ok((await api('/api/projects/' + projectId, 'DELETE')).ok);
  mkdirSync('artifacts/b7', { recursive: true });
  writeFileSync(
    'artifacts/b7/acceptance.json',
    JSON.stringify({ results, completedAt: new Date().toISOString() }, null, 2),
  );
}
