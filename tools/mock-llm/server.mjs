import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
const port = Number(process.env.MOCK_LLM_PORT || 4010),
  requests = [];
let scenario = { failure: process.env.MOCK_FAILURE || 'none', rules: [] };
const failures = new Set([
  'none',
  '401',
  '429',
  '500',
  'timeout',
  'slow',
  'malformed',
  'schema-invalid',
  'empty',
  'dimension',
  'guardrail-assumption',
  'unsafe-rewrite',
  'revision-drop-id',
]);
export function embedding(text, dimensions = 1536) {
  const vector = Array(dimensions).fill(0);
  for (const word of String(text)
    .toLowerCase()
    .match(/[\p{L}\p{N}]+/gu) || []) {
    const hash = createHash('sha256').update(word).digest();
    vector[hash.readUInt32BE(0) % dimensions] += 1;
  }
  const norm = Math.hypot(...vector) || 1;
  return vector.map((value) => value / norm);
}
const hash = (value) => createHash('sha256').update(value).digest('hex');
function taskFrom(input) {
  const prompt = (input.messages || []).map((m) => m.content).join('\n');
  try {
    return {
      task: JSON.parse(prompt.match(/<task_json>([\s\S]*?)<\/task_json>/)?.[1] || '{}'),
      prompt,
    };
  } catch {
    return { task: {}, prompt };
  }
}
function chapter(task, failure) {
  if (task.kind === 'refine')
    return {
      queries: [
        task.instruction || 'requirements',
        `${task.instruction || 'requirements'} verification security`,
      ],
      intent: 'targeted revision',
    };
  if (task.kind === 'revision')
    return {
      revised_text:
        (failure === 'revision-drop-id'
          ? String(task.current_text).replaceAll('REQ-F-01', 'REQ-F-99')
          : task.current_text) + `\n\n${task.instruction}`,
      requirements: [],
    };
  if (task.kind === 'guardrail') {
    const original = task.chapter,
      rewrites = [];
    const first = original?.sections?.flatMap((s) => s.requirements || [])[0];
    if (failure === 'guardrail-assumption' && first)
      rewrites.push({
        original: first.description,
        rewritten: `${first.description} Respons harus selesai dalam 987654321 detik.`,
        reason: 'Synthetic unsupported numeric target',
        needs_confirmation: false,
      });
    if (failure === 'unsafe-rewrite')
      rewrites.push({
        original: 'REQ-F-01',
        rewritten: 'REQ-F-99',
        reason: 'Synthetic forbidden ID change',
        needs_confirmation: false,
      });
    return {
      dimensions: ['unambiguous', 'complete', 'correct', 'verifiable'].map((name) => ({
        name,
        verdict: 'pass',
        passed: true,
        reason: 'Deterministic mock evaluation; not a research rating.',
      })),
      rewrites,
      corrected: original,
    };
  }
  if (task.kind === 'summary')
    return {
      summary: String(task.text || '').slice(0, Math.max(1, Number(task.max_chars) || 8000)),
    };
  const number = String(task.number || 1),
    subsections = task.subsections || [{ number: `${number}.1`, title: 'Purpose' }];
  return {
    number,
    title: task.title || 'Introduction',
    sections: subsections.map((section) => ({
      number: section.number,
      title: section.title,
      body:
        task.language === 'en'
          ? `The system shall support ${task.project_title || 'the project'}: ${section.title}. Synthetic development output.`
          : `Sistem harus mendukung ${task.project_title || 'proyek'}: ${section.title}. Synthetic development output.`,
      requirements:
        section.number === '3.2'
          ? [
              {
                id: 'REQ-F-01',
                title: 'Pencatatan kebutuhan',
                description: 'Sistem harus menyimpan kebutuhan yang divalidasi pengguna.',
                actor: 'Penulis',
                input: 'Kebutuhan tervalidasi',
                process: 'Validasi dan penyimpanan',
                output: 'Konfirmasi tersimpan',
                priority: 'High',
              },
            ]
          : [],
    })),
  };
}
function selectFailure(req, url, task) {
  if (req.headers['x-mock-failure']) return { failure: String(req.headers['x-mock-failure']) };
  for (const rule of scenario.rules) {
    if (
      rule.remaining === 0 ||
      (rule.path && !url.pathname.endsWith(rule.path)) ||
      (rule.kind && task.kind !== rule.kind) ||
      (rule.number && String(task.number ?? task.chapter?.number) !== String(rule.number)) ||
      (rule.session_id && rule.session_id !== task.session_id)
    )
      continue;
    if (rule.skip > 0) {
      rule.skip--;
      continue;
    }
    if (Number.isFinite(rule.remaining)) rule.remaining--;
    return rule;
  }
  return { failure: scenario.failure };
}
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const reply = (status, data, headers = {}) => {
    if (res.destroyed) return;
    res.writeHead(status, { 'Content-Type': 'application/json', ...headers });
    res.end(JSON.stringify(data));
  };
  if (url.pathname === '/health') return reply(200, { ok: true, mock: true });
  let text = '';
  for await (const part of req) {
    text += part;
    if (text.length > 4 * 1024 * 1024) return reply(413, { error: { code: 'too_large' } });
  }
  let input = {};
  try {
    input = JSON.parse(text || '{}');
  } catch {
    return reply(400, { error: { code: 'invalid_json' } });
  }
  if (url.pathname.startsWith('/__test/')) {
    if (
      !process.env.MOCK_CONTROL_TOKEN ||
      req.headers.authorization !== `Bearer ${process.env.MOCK_CONTROL_TOKEN}`
    )
      return reply(401, { error: { code: 'unauthorized' } });
    if (url.pathname === '/__test/reset') {
      requests.length = 0;
      scenario = { failure: 'none', rules: [] };
      return reply(200, { ok: true });
    }
    if (url.pathname === '/__test/scenario') {
      if (
        !failures.has(input.failure || 'none') ||
        !Array.isArray(input.rules ?? []) ||
        (input.rules ?? []).some((r) => !failures.has(r.failure))
      )
        return reply(400, { error: { code: 'invalid_scenario' } });
      scenario = {
        failure: input.failure || 'none',
        rules: (input.rules || []).map((rule) => ({
          ...rule,
          remaining: rule.times === undefined ? Infinity : Math.max(0, Number(rule.times)),
          skip: Math.max(0, Number(rule.skip) || 0),
        })),
      };
      return reply(200, { ok: true });
    }
    if (url.pathname === '/__test/requests') return reply(200, { requests });
    return reply(404, { error: { code: 'not_found' } });
  }
  if (/^\/api\/webhooks\/srs-(?:ready|failed|revision-ready)$/.test(url.pathname)) {
    // A deliberately failing local callback target, used only by the B5 harness.
    // Do not record the callback body or its authorization header.
    requests.push({
      path: url.pathname,
      kind: 'callback',
      session_id: input.session_id ?? null,
      at: new Date().toISOString(),
      status: 503,
    });
    return reply(503, { error: { code: 'synthetic_callback_unavailable' } });
  }
  const key = String(req.headers.authorization || '').replace(/^Bearer /, '');
  if (!key.startsWith('naskah-test-')) return reply(401, { error: { code: 'invalid_api_key' } });
  const { task, prompt } = taskFrom(input),
    rule = selectFailure(req, url, task),
    failure = rule.failure;
  const capture = {
    path: url.pathname,
    keyHash: hash(key),
    at: new Date().toISOString(),
    failure,
    kind: task.kind ?? null,
    number: task.number ?? task.chapter?.number ?? null,
    session_id: task.session_id ?? null,
    run_id: task.run_id ?? null,
    revision_id: task.revision_id ?? null,
    repair: task.repair === true,
    promptHash: hash(prompt),
    model: input.model ?? null,
  };
  requests.push(capture);
  if (requests.length > 2000) requests.shift();
  if (failure === '401') return reply(401, { error: { code: 'invalid_api_key' } });
  if (failure === '429')
    return reply(
      429,
      { error: { code: 'rate_limited' } },
      { 'Retry-After': String(rule.retry_after ?? 1) },
    );
  if (failure === '500') return reply(500, { error: { code: 'server_error' } });
  if (failure === 'timeout' || failure === 'slow') {
    await new Promise((resolve) => {
      const timer = setTimeout(
        resolve,
        Number(rule.delay_ms) || (failure === 'timeout' ? 65000 : 1500),
      );
      res.once('close', () => {
        clearTimeout(timer);
        resolve();
      });
    });
    if (res.destroyed) return;
  }
  if (url.pathname.endsWith('/models'))
    return reply(200, {
      object: 'list',
      data: [
        'deepseek-flash',
        'deepseek-v4-flash',
        'text-embedding-3-small',
        'naskah-test-model',
      ].map((id) => ({ id, object: 'model' })),
    });
  if (url.pathname.endsWith('/embeddings')) {
    const inputs = Array.isArray(input.input) ? input.input : [input.input];
    return reply(200, {
      model: input.model,
      data: inputs.map((value, index) => ({
        index,
        embedding: embedding(value, failure === 'dimension' ? 8 : input.dimensions || 1536),
      })),
      usage: {
        prompt_tokens: inputs.join(' ').split(/\s+/).length,
        total_tokens: inputs.join(' ').split(/\s+/).length,
      },
    });
  }
  if (url.pathname.endsWith('/chat/completions')) {
    let content = input.max_tokens === 1 ? 'OK' : JSON.stringify(chapter(task, failure));
    if (failure === 'malformed') content = '{broken';
    if (failure === 'schema-invalid') content = '{"invalid":true}';
    if (failure === 'empty') content = '   ';
    return reply(200, {
      id: `mock-${hash(prompt).slice(0, 16)}`,
      model: input.model,
      choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
      usage: {
        prompt_tokens: Math.ceil(prompt.length / 4),
        completion_tokens: Math.ceil(content.length / 4),
        total_tokens: Math.ceil((prompt.length + content.length) / 4),
      },
    });
  }
  reply(404, { error: { code: 'not_found' } });
});
server.listen(port, '0.0.0.0', () =>
  console.log(
    `Mock provider listening on ${port}; request bodies and credentials are never logged.`,
  ),
);
