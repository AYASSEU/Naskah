import { worker } from './worker.mjs';
import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
const token = process.env.COMPILER_SERVICE_TOKEN;
if (!token || token.length < 32) throw new Error('COMPILER_SERVICE_TOKEN missing');
const versions = {
  pandoc: execFileSync('pandoc', ['--version'], { encoding: 'utf8' }).split('\n')[0],
  libreoffice: execFileSync('libreoffice', ['--version'], { encoding: 'utf8' }).trim(),
  font: execFileSync('fc-match', ['-f', '%{family}', 'Times New Roman'], {
    encoding: 'utf8',
  }).trim(),
};
let active = 0;
async function body(req, limit) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new Error('too_large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
const server = http.createServer(async (req, res) => {
  const send = (status, value) => {
    if (!res.destroyed) {
      res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(value));
    }
  };
  if (req.url === '/health' && req.method === 'GET')
    return send(200, {
      ok: true,
      compiler_id: process.env.COMPILER_ID,
      ...versions,
      active,
      rss: process.memoryUsage().rss,
    });
  const actual = Buffer.from(req.headers.authorization ?? ''),
    expected = Buffer.from('Bearer ' + token);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    return send(401, { error: 'unauthorized' });
  if (req.method !== 'POST' || !['/parse', '/compile'].includes(req.url))
    return send(404, { error: 'not_found' });
  if (active >= 2) return send(503, { error: 'document_busy' });
  active++;
  let dir;
  try {
    dir = await mkdtemp('/tmp/naskah-');
    const data = await body(req, req.url === '/parse' ? 10 * 1024 * 1024 : 5 * 1024 * 1024);
    if (req.url === '/parse') {
      if (data.subarray(0, 5).toString() !== '%PDF-') throw new Error('invalid_file');
      await writeFile(join(dir, 'input.pdf'), data);
      const result = JSON.parse(
        await worker(
          process.execPath,
          ['--max-old-space-size=128', 'parse.mjs', join(dir, 'input.pdf')],
          20000,
        ),
      );
      send(200, result);
    } else {
      let input;
      try {
        input = JSON.parse(data);
      } catch {
        throw new Error('invalid_input');
      }
      if (
        typeof input.markdown !== 'string' ||
        input.markdown.length > 4000000 ||
        !input.metadata ||
        !['title', 'project', 'version', 'author', 'institution', 'date'].every(
          (key) => typeof input.metadata[key] === 'string' && input.metadata[key].length <= 500,
        )
      )
        throw new Error('invalid_input');
      await writeFile(join(dir, 'input.json'), JSON.stringify(input));
      await worker('python3', ['compile.py', dir], 90000);
      const output = await readFile(join(dir, 'output.zip'));
      if (output.length > 50 * 1024 * 1024) throw new Error('too_large');
      if (!res.destroyed) {
        res.writeHead(200, {
          'Content-Type': 'application/zip',
          'Content-Length': output.length,
          'Cache-Control': 'no-store',
        });
        res.end(output);
      }
    }
  } catch (error) {
    const known = [
      'too_large',
      'page_limit',
      'no_text_layer',
      'encrypted_pdf',
      'invalid_file',
      'invalid_input',
      'unsafe_document',
      'document_timeout',
      'document_busy',
      'compiler_failed',
    ];
    const code = known.includes(error.message) ? error.message : 'compiler_failed';
    send(code === 'document_timeout' ? 504 : code === 'too_large' ? 413 : 422, { error: code });
  } finally {
    if (dir?.startsWith('/tmp/naskah-')) await rm(dir, { recursive: true, force: true });
    active--;
  }
});
server.requestTimeout = 30000;
server.headersTimeout = 15000;
server.listen(8000, '0.0.0.0');
