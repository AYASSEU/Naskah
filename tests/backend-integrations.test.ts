import { describe, it, expect, vi } from 'vitest';
import { BackendErrorCodes } from '../packages/contracts/src/backend';
import en from '../apps/web/src/shared/i18n/messages/en.json';
import id from '../apps/web/src/shared/i18n/messages/id.json';
import { N8nClient, N8nApiError } from '../apps/web/src/server/n8n/client';
describe('integration boundaries', () => {
  it('provides an actionable message for every backend error in both languages', () => {
    for (const code of BackendErrorCodes) {
      expect(en.backendErrors[code]).toBeTruthy();
      expect(id.backendErrors[code]).toBeTruthy();
    }
    expect(Object.keys(en.backendErrors).sort()).toEqual(Object.keys(id.backendErrors).sort());
  });
  it('rebinds all references before removing a credential on an older n8n API', async () => {
    const client = new N8nClient('http://localhost:5679', 'generated-in-memory-test-value');
    const operations: string[] = [];
    vi.spyOn(client, 'request').mockImplementation(async (path, method) => {
      operations.push(`${method}:${path}`);
      if (method === 'PATCH' || method === 'PUT') throw new N8nApiError(405);
      return undefined;
    });
    vi.spyOn(client, 'createCredential').mockImplementation(async () => {
      operations.push('create');
      return { id: 'new', name: 'rotated' };
    });
    vi.spyOn(client, 'rebind').mockImplementation(async () => {
      operations.push('rebind');
      return [];
    });
    expect(
      await client.updateCredential('old', 'naskah/test', 'httpHeaderAuth', {
        name: 'Authorization',
        value: 'test',
      }),
    ).toEqual({ id: 'new', name: 'rotated' });
    expect(operations).toEqual([
      'PATCH:credentials/old',
      'PUT:credentials/old',
      'create',
      'rebind',
      'DELETE:credentials/old',
    ]);
  });
  it('does not recreate credentials when permission is denied', async () => {
    const client = new N8nClient('http://localhost:5678', 'generated-in-memory-test-value');
    vi.spyOn(client, 'request').mockRejectedValue(new N8nApiError(403));
    const create = vi.spyOn(client, 'createCredential');
    await expect(
      client.updateCredential('old', 'test', 'httpHeaderAuth', {}),
    ).rejects.toMatchObject({ code: 'n8n_unauthorized' });
    expect(create).not.toHaveBeenCalled();
  });
});
