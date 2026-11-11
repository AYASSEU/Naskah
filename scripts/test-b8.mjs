import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
process.loadEnvFile('apps/web/.env.local');
const require = createRequire(new URL('../apps/web/package.json', import.meta.url)),
  postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false, onnotice: () => {} });
const base = 'http://127.0.0.1:3000',
  prefix = 'B8_' + randomUUID().slice(0, 8),
  results = [],
  projects = [],
  digests = new Set();
mkdirSync('artifacts/b8', { recursive: true });
class Client {
  cookies = new Map();
  async call(path, method = 'GET', body, headers = {}) {
    const response = await fetch(base + path, {
      method,
      headers: {
        'X-Naskah-Client': 'web',
        Cookie: [...this.cookies].map(([k, v]) => k + '=' + v).join('; '),
        ...(method === 'GET' ? {} : { Origin: base }),
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    for (const cookie of response.headers.getSetCookie()) {
      const [key, ...rest] = cookie.split(';')[0].split('=');
      this.cookies.set(key, rest.join('='));
    }
    return response;
  }
  async session() {
    await value(await this.call('/api/auth/session'));
    return this;
  }
}
async function value(response) {
  const body = await response.json();
  assert.ok(response.ok, JSON.stringify({ status: response.status, body }));
  return body;
}
async function check(name, action) {
  const at = Date.now();
  await action();
  results.push({ name, passed: true, ms: Date.now() - at });
  console.log('PASS ' + name);
}
const admin = await new Client().session();
let paired, independent, expert;
async function makeCase(design) {
  const project = await value(
    await admin.call('/api/projects', 'POST', {
      title: prefix + ' synthetic ' + design,
      domain: 'Healthcare',
      version: '1.0',
      rawText: 'Synthetic B8 acceptance fixture',
      status: 'in_review',
    }),
  );
  projects.push(project.id);
  const doc = await value(await admin.call('/api/documents/' + project.id));
  await value(
    await admin.call('/api/documents/' + project.id + '/versions', 'POST', {
      sections: doc.sections.map((s) => ({
        ...s,
        markdown: 'Sistem harus mencatat data dan memverifikasi hasil. ' + s.number,
        status: 'edited',
        source: 'human',
      })),
      label: 'B8 synthetic snapshot',
    }),
  );
  return value(
    await admin.call('/api/evaluation/cases?scope=dev', 'POST', {
      projectId: project.id,
      title: prefix + ' ' + design,
      baselineMarkdown:
        '# 1. Introduction\n\nSistem harus mencatat data dan memeriksa hasil.\n\n## 1.1 Purpose\n\nSistem mencatat data.',
      referenceLanguage: 'id',
      provenanceNote: 'Synthetic acceptance baseline only',
      design,
    }),
  );
}
async function participant(index, role = 'expert') {
  const client = await new Client().session();
  const response = await client.call('/api/evaluation/context?scope=dev', 'POST', {
    code: prefix + '_' + index,
    role,
    consent: true,
  });
  assert.ok(response.headers.get('set-cookie').includes('HttpOnly'));
  await value(response);
  return client;
}
async function rate(client, c, index) {
  const docs = await value(await client.call('/api/evaluation/blind?scope=dev&caseId=' + c.id));
  for (const d of docs)
    await value(
      await client.call('/api/evaluation/reviews?scope=dev', 'POST', {
        assignmentId: d.id,
        ratings: [4 - (index % 2), 4, 3 + (index % 2), 4],
        justifications: [
          'Specific synthetic reason',
          'Complete synthetic reason',
          'Correct synthetic reason',
          'Verifiable synthetic reason',
        ],
        comments: 'B8_PRIVATE_FREE_TEXT_' + prefix,
      }),
    );
  return {
    docs,
    mapping: await value(await client.call('/api/evaluation/mapping?scope=dev&caseId=' + c.id)),
  };
}
try {
  await check('owner, origin, consent and participant session boundaries', async () => {
    assert.equal((await fetch(base + '/api/evaluation/overview')).status, 401);
    assert.equal(
      (
        await admin.call('/api/evaluation/context?scope=dev', 'POST', {
          code: prefix,
          role: 'expert',
          consent: false,
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await admin.call(
          '/api/evaluation/context?scope=dev',
          'POST',
          { code: prefix, role: 'expert', consent: true },
          { Origin: 'https://example.invalid' },
        )
      ).status,
      403,
    );
    assert.equal(
      (await admin.call('/api/evaluation/sus?scope=dev', 'POST', { answers: Array(10).fill(3) }))
        .status,
      403,
    );
    paired = await makeCase('paired');
    independent = await makeCase('independent');
    expert = await participant('expert');
    const impostor = await new Client().session();
    assert.equal(
      (
        await impostor.call('/api/evaluation/context?scope=dev', 'POST', {
          code: prefix + '_expert',
          role: 'expert',
          consent: true,
        })
      ).status,
      409,
    );
    assert.equal(
      (await admin.call('/api/evaluation/blind?scope=dev&caseId=' + paired.id)).status,
      403,
    );
  });
  await check('blind paired snapshots, submission gating and immutable reviews', async () => {
    const docs = await value(
      await expert.call('/api/evaluation/blind?scope=dev&caseId=' + paired.id),
    );
    assert.equal(docs.length, 2);
    for (const d of docs)
      assert.deepEqual(Object.keys(d).sort(), ['caseId', 'id', 'label', 'markdown', 'submitted']);
    assert.equal(
      (await expert.call('/api/evaluation/mapping?scope=dev&caseId=' + paired.id)).status,
      403,
    );
    const input = {
      assignmentId: docs[0].id,
      ratings: [4, 4, 4, 4],
      justifications: ['One', 'Two', 'Three', 'Four'],
      comments: 'B8_PRIVATE_FREE_TEXT_' + prefix,
    };
    const saved = await value(
      await expert.call('/api/evaluation/reviews?scope=dev', 'POST', input),
    );
    assert.equal(
      (await expert.call('/api/evaluation/mapping?scope=dev&caseId=' + paired.id)).status,
      403,
    );
    const snapshot = await value(await admin.call('/api/evaluation/export?scope=dev&format=json'));
    assert.ok(!snapshot.datasets.reviews.some((row) => row.participant === prefix + '_expert'));
    const repeated = await value(
      await expert.call('/api/evaluation/reviews?scope=dev', 'POST', input),
    );
    assert.equal(repeated.id, saved.id);
    assert.equal(
      (
        await expert.call('/api/evaluation/reviews?scope=dev', 'POST', {
          ...input,
          ratings: [1, 1, 1, 1],
        })
      ).status,
      409,
    );
    assert.equal(
      (await admin.call('/api/evaluation/reviews?scope=dev', 'POST', input)).status,
      403,
    );
    await value(
      await expert.call('/api/evaluation/reviews?scope=dev', 'POST', {
        ...input,
        assignmentId: docs[1].id,
        ratings: [3, 3, 3, 3],
      }),
    );
    const mapping = await value(
      await expert.call('/api/evaluation/mapping?scope=dev&caseId=' + paired.id),
    );
    assert.deepEqual(
      new Set(Object.values(mapping)),
      new Set(['system_simulated', 'human_synthetic_sample']),
    );
  });
  await check('SUS is recomputed, idempotent and matches shared golden vectors', async () => {
    const golden = JSON.parse(readFileSync('tests/fixtures/evaluation/golden.json', 'utf8'));
    for (const [index, vector] of golden.sus.entries()) {
      const client = await participant('sus' + index, 'participant');
      const input = {
        answers: vector.answers,
        score: 12345,
        comment: 'B8_PRIVATE_FREE_TEXT_' + prefix,
      };
      const r = await value(await client.call('/api/evaluation/sus?scope=dev', 'POST', input));
      assert.equal(r.score, vector.score);
      assert.equal(
        (
          await value(
            await client.call('/api/evaluation/sus?scope=dev', 'POST', { ...input, score: 0 }),
          )
        ).id,
        r.id,
      );
      assert.equal(
        (await client.call('/api/evaluation/sus?scope=dev', 'POST', { ...input, answers: [1, 2] }))
          .status,
        400,
      );
    }
  });
  await check('mock data cannot become research data or cross scopes', async () => {
    const researchClient = await new Client().session();
    await value(
      await researchClient.call('/api/evaluation/context?scope=research', 'POST', {
        code: prefix + '_research',
        role: 'expert',
        consent: true,
      }),
    );
    const r = await researchClient.call('/api/evaluation/sus?scope=research', 'POST', {
      projectId: paired.projectId,
      answers: Array(10).fill(3),
    });
    assert.equal(r.status, 409);
    assert.equal((await r.json()).code, 'dev_seed_excluded');
    const cases = await researchClient.call('/api/evaluation/cases?scope=research', 'POST', {
      projectId: paired.projectId,
      title: 'Not a research run',
      baselineMarkdown: 'Reference',
      referenceLanguage: 'id',
      provenanceNote: 'Synthetic baseline is ineligible',
      design: 'paired',
    });
    assert.equal(cases.status, 409);
    assert.equal(
      (await researchClient.call('/api/evaluation/seed?scope=research', 'POST', {})).status,
      409,
    );
    assert.equal(
      (await researchClient.call('/api/evaluation/blind?scope=research&caseId=' + paired.id))
        .status,
      404,
    );
    const overview = await value(
      await researchClient.call('/api/evaluation/overview?scope=research'),
    );
    assert.equal(overview.counts.sus, 0);
    assert.equal(overview.counts.cases, 0);
    assert.ok(
      (await value(await admin.call('/api/evaluation/logs?scope=research'))).every(
        (r) => r.is_thesis_run,
      ),
    );
  });
  await check('paired and independent analyses use actual persisted participants', async () => {
    for (let i = 0; i < 2; i++) await rate(await participant('paired' + i), paired, i);
    const report = await value(
      await admin.call('/api/evaluation/statistics?scope=dev', 'POST', {
        design: 'paired',
        seed: 20261110,
      }),
    );
    digests.add(report.provenance.input_digest);
    assert.equal(report.unit, 'participant_mean_across_cases');
    assert.equal(report.results.length, 4);
    assert.ok(report.results.every((r) => r.n >= 3 && Number.isFinite(r.p_adjusted)));
    const bad = structuredClone(report);
    bad.results[0].effect_size = 99;
    assert.equal((await admin.call('/api/evaluation/import?scope=dev', 'POST', bad)).status, 422);
    assert.ok((await admin.call('/api/evaluation/import?scope=dev', 'POST', report)).ok);
    assert.equal(
      (await admin.call('/api/evaluation/import?scope=research', 'POST', report)).status,
      409,
    );
    let human = 0,
      system = 0;
    for (let i = 0; i < 40 && (human < 2 || system < 2); i++) {
      const r = await rate(await participant('independent' + i), independent, i);
      assert.equal(r.docs.length, 1);
      if (r.mapping.A === 'system_simulated') system++;
      else human++;
    }
    assert.ok(human >= 2 && system >= 2);
    const independentReport = await value(
      await admin.call('/api/evaluation/statistics?scope=dev', 'POST', {
        design: 'independent',
        seed: 20261110,
      }),
    );
    digests.add(independentReport.provenance.input_digest);
    assert.equal(independentReport.results[0].test, 'mann_whitney');
    writeFileSync('artifacts/b8/statistics.json', JSON.stringify(report, null, 2));
  });
  await check('ROUGE language guard, verified import and persisted result', async () => {
    const result = await value(
      await admin.call('/api/evaluation/rouge?scope=dev', 'POST', { caseIds: [paired.id] }),
    );
    assert.equal(result.results[0].valid_comparison, true);
    assert.ok((await admin.call('/api/evaluation/import?scope=dev', 'POST', result)).ok);
    const changed = structuredClone(result);
    changed.results[0].rouge1.f1 = 0.999;
    assert.equal(
      (await admin.call('/api/evaluation/import?scope=dev', 'POST', changed)).status,
      422,
    );
    const mismatch = await value(
      await admin.call('/api/evaluation/cases?scope=dev', 'POST', {
        projectId: paired.projectId,
        title: prefix + ' language mismatch',
        baselineMarkdown: 'System shall record data.',
        referenceLanguage: 'en',
        provenanceNote: 'Synthetic mismatch test',
        design: 'paired',
      }),
    );
    assert.equal(
      (await admin.call('/api/evaluation/rouge?scope=dev', 'POST', { caseIds: [mismatch.id] }))
        .status,
      422,
    );
    const invalid = await value(
      await admin.call('/api/evaluation/rouge?scope=dev', 'POST', {
        caseIds: [mismatch.id],
        allowLanguageMismatch: true,
        overrideReason: 'Synthetic language guard test only',
      }),
    );
    assert.equal(invalid.results[0].valid_comparison, false);
    writeFileSync('artifacts/b8/rouge.json', JSON.stringify(result, null, 2));
  });
  await check('anonymous exports, offline CLI roundtrip and scope separation', async () => {
    const response = await admin.call('/api/evaluation/export?scope=dev&format=json');
    assert.ok(response.headers.get('content-disposition').includes('attachment'));
    const snapshot = await value(response),
      text = JSON.stringify(snapshot);
    assert.ok(!text.includes(prefix));
    assert.ok(!text.includes('B8_PRIVATE_FREE_TEXT'));
    assert.ok(!text.includes('"owner_id"'));
    assert.ok(!text.includes('"markdown"'));
    assert.ok(snapshot.datasets.sus.every((r) => !r.is_thesis_run));
    assert.ok(snapshot.datasets.reviews.every((r) => r.participant.length === 24));
    writeFileSync('artifacts/b8/snapshot.json', JSON.stringify(snapshot, null, 2));
    const directory = resolve('artifacts/b8'),
      run = spawnSync(
        'docker',
        [
          'run',
          '--rm',
          '--network',
          'none',
          '--mount',
          `type=bind,source=${directory},target=/data`,
          '--entrypoint',
          'python',
          'naskah-evaluation:local',
          '-m',
          'evaluation_scripts',
          'stats',
          '--input',
          '/data/snapshot.json',
          '--output',
          '/data/offline-statistics.json',
        ],
        { encoding: 'utf8', windowsHide: true },
      );
    assert.equal(run.status, 0, run.stderr);
    const offline = JSON.parse(readFileSync('artifacts/b8/offline-statistics.json', 'utf8'));
    assert.ok((await admin.call('/api/evaluation/import?scope=dev', 'POST', offline)).ok);
    const csv = await admin.call('/api/evaluation/export?scope=dev&format=csv&dataset=reviews');
    assert.equal(csv.headers.get('cache-control'), 'private, no-store');
    assert.ok(!(await csv.text()).includes('B8_PRIVATE_FREE_TEXT'));
    const research = await value(
      await admin.call('/api/evaluation/export?scope=research&format=json'),
    );
    assert.ok(Object.values(research.datasets).every((rows) => rows.length === 0));
  });
} finally {
  for (const project of projects)
    assert.ok((await admin.call('/api/projects/' + project, 'DELETE')).ok);
  await sql`delete from public.participants where owner_id=${process.env.LOCAL_OWNER_ID} and code like ${prefix + '%'}`;
  for (const digest of digests)
    await sql`delete from public.statistical_results where owner_id=${process.env.LOCAL_OWNER_ID} and not is_thesis_run and result->'provenance'->>'input_digest'=${digest}`;
  await sql.end();
  writeFileSync(
    'artifacts/b8/acceptance.json',
    JSON.stringify({ at: new Date().toISOString(), results, mockOnly: true }, null, 2),
  );
}
