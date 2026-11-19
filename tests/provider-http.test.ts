import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createServer } from 'node:http';
import { providerFetch } from '@/server/security/urls';

const requests: { path: string; authorization: string | undefined }[] = [];
const server = createServer((request, response) => {
  requests.push({ path: request.url ?? '', authorization: request.headers.authorization });
  if (request.url === '/redirect') {
    response.writeHead(302, { Location: '/models' });
    response.end();
    return;
  }
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify({ data: [{ id: 'local-test-model' }] }));
});
let base: string;

beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Local test server unavailable');
  base = `http://127.0.0.1:${address.port}`;
});
beforeEach(() => {
  requests.length = 0;
});
afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});

describe('provider HTTP compatibility', () => {
  it('reads provider JSON through the guarded Undici agent', async () => {
    const response = await providerFetch(base, '/models', 'local-test-key', true);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: [{ id: 'local-test-model' }] });
    expect(requests).toEqual([{ path: '/models', authorization: 'Bearer local-test-key' }]);
  });

  it('rejects redirects before sending another authenticated request', async () => {
    await expect(providerFetch(base, '/redirect', 'local-test-key', true)).rejects.toThrow();
    expect(requests.map((request) => request.path)).toEqual(['/redirect']);
  });
});
