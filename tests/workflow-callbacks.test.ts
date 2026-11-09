import { describe, it, expect, vi } from 'vitest';
import { randomBytes } from 'node:crypto';
const test = vi.hoisted(() => ({
  secret: 'naskah-test-callback-' + Math.random().toString(36),
  transaction: vi.fn(),
}));
vi.mock('@/server/config/env.server', () => ({
  env: () => ({ N8N_CALLBACK_SECRET: test.secret }),
}));
vi.mock('@/server/db/client', () => ({ transaction: test.transaction }));
import { callbackRoute } from '@/server/workflows/callbacks';
const id = '5e815ea4-a00e-4313-941d-cf6ec25b0339';
const body = {
  event_id: id,
  session_id: id,
  run_id: id,
  execution_id: '42',
  sent_at: '2000-01-01T00:00:00.000Z',
  markdown: 'Synthetic document',
  document: {
    projectId: id,
    templateId: 'ieee-830-1998',
    sections: [],
    chunks: [],
    metadata: {
      title: 'Synthetic',
      domain: 'test',
      createdAt: '2000-01-01T00:00:00.000Z',
      generationSeconds: 0,
    },
  },
  metrics: {},
};
const request = (value: unknown, authorized = true, headers: Record<string, string> = {}) =>
  new Request('http://localhost:3000/api/webhooks/srs-ready', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authorized
        ? { Authorization: `Bearer ${test.secret}` }
        : { Authorization: 'Bearer ' + randomBytes(12).toString('hex') }),
      ...headers,
    },
    body: JSON.stringify(value),
  });
describe('authenticated workflow callbacks', () => {
  it('rejects a wrong bearer before reading private data or opening a transaction', async () => {
    const response = await callbackRoute(request({ private: 'synthetic-marker' }, false), 'ready');
    expect(response.status).toBe(401);
    expect(await response.text()).not.toContain('synthetic-marker');
    expect(test.transaction).not.toHaveBeenCalled();
  });
  it('rejects a stale callback before any database mutation', async () => {
    const response = await callbackRoute(request(body), 'ready');
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: 'stale_callback' });
    expect(test.transaction).not.toHaveBeenCalled();
  });
  it('returns a typed validation error without reflecting the submitted document', async () => {
    const response = await callbackRoute(
      request({ markdown: 'private-synthetic-marker' }),
      'ready',
    );
    expect(response.status).toBe(400);
    expect(await response.text()).not.toContain('private-synthetic-marker');
    expect(test.transaction).not.toHaveBeenCalled();
  });
  it('rejects oversized callback bodies before allocation or persistence', async () => {
    const response = await callbackRoute(
      request({}, true, { 'Content-Length': String(9 * 1024 * 1024) }),
      'ready',
    );
    expect(response.status).toBe(413);
    expect(test.transaction).not.toHaveBeenCalled();
  });
});
