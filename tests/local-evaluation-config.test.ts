import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { POST } from '../apps/web/src/app/api/local-bertscore/route';

const fetchMock = vi.fn();
beforeEach(() => {
  for (const key of [
    'APP_ENCRYPTION_KEY',
    'LOCAL_OWNER_ID',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'DATABASE_URL',
    'N8N_API_KEY',
    'N8N_WEBHOOK_SECRET',
    'N8N_CALLBACK_SECRET',
  ])
    vi.stubEnv(key, undefined);
  vi.stubEnv('EVALUATION_SERVICE_URL', 'http://127.0.0.1:8010');
  vi.stubEnv('EVALUATION_SERVICE_TOKEN', 'local-evaluator-test-token-000000000');
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function request() {
  return new Request('http://127.0.0.1:3000/api/local-bertscore', {
    method: 'POST',
    headers: {
      origin: 'http://127.0.0.1:3000',
      host: '127.0.0.1:3000',
      'x-naskah-client': 'web',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      candidate: 'Sistem mencatat transaksi.',
      reference: 'Sistem mencatat transaksi.',
      language: 'id',
    }),
  });
}

it('runs local evaluation with evaluator settings only on a new laptop', async () => {
  fetchMock.mockResolvedValue(
    Response.json({
      results: [{ precision: 1, recall: 1, f1: 1 }],
      provenance: {
        model: 'test',
        revision: '1',
        engine: 'test',
        layer: 5,
        window_tokens: 510,
        idf: false,
        rescale_with_baseline: false,
      },
    }),
  );
  const response = await POST(request());
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ precision: 1, recall: 1, f1: 1 });
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(String(fetchMock.mock.calls[0]![0])).toBe('http://127.0.0.1:8010/evaluate');
  expect(fetchMock.mock.calls[0]![1].headers.Authorization).toBe(
    'Bearer local-evaluator-test-token-000000000',
  );
});

it.each([undefined, 'too-short'])(
  'rejects a missing or invalid evaluator token (%s)',
  async (token) => {
    vi.stubEnv('EVALUATION_SERVICE_TOKEN', token);
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: 'evaluation_unavailable' });
    expect(fetchMock).not.toHaveBeenCalled();
  },
);
