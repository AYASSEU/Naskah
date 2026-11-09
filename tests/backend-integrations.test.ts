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
  it('adopts transferred credentials when the app binding is absent or stale', async () => {
    for (const binding of [undefined, 'missing-id']) {
      const client = new N8nClient('http://localhost:5680', 'in-memory-dummy');
      vi.spyOn(client, 'request').mockRejectedValue(new N8nApiError(404));
      vi.spyOn(client, 'list').mockResolvedValue([
        { id: 'transferred-id', name: 'naskah/embeddings', type: 'httpHeaderAuth' },
      ]);
      const update = vi
        .spyOn(client, 'updateCredential')
        .mockResolvedValue({ id: 'transferred-id', name: 'naskah/embeddings' });
      const create = vi.spyOn(client, 'createCredential');
      await expect(
        client.syncNamedCredential('naskah/embeddings', 'httpHeaderAuth', {}, binding),
      ).resolves.toMatchObject({ id: 'transferred-id' });
      expect(update).toHaveBeenCalledWith(
        'transferred-id',
        'naskah/embeddings',
        'httpHeaderAuth',
        {},
      );
      expect(create).not.toHaveBeenCalled();
    }
  });
  it('refuses ambiguous names or incompatible credential types without writing', async () => {
    const client = new N8nClient('http://localhost:5681', 'in-memory-dummy');
    const list = vi.spyOn(client, 'list').mockResolvedValue([
      { id: 'a', name: 'naskah/embeddings', type: 'httpHeaderAuth' },
      { id: 'b', name: 'naskah/embeddings', type: 'httpHeaderAuth' },
    ]);
    const update = vi.spyOn(client, 'updateCredential'),
      create = vi.spyOn(client, 'createCredential');
    await expect(
      client.syncNamedCredential('naskah/embeddings', 'httpHeaderAuth', {}),
    ).rejects.toMatchObject({ code: 'credential_name_ambiguous' });
    list.mockResolvedValue([{ id: 'a', name: 'naskah/embeddings', type: 'httpBasicAuth' }]);
    await expect(
      client.syncNamedCredential('naskah/embeddings', 'httpHeaderAuth', {}),
    ).rejects.toMatchObject({ code: 'credential_schema_mismatch' });
    expect(update).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });
  it('protects foreign bindings and never treats permission denial as a missing credential', async () => {
    const client = new N8nClient('http://localhost:5682', 'in-memory-dummy');
    const request = vi
      .spyOn(client, 'request')
      .mockResolvedValue({ id: 'personal', name: 'personal/service', type: 'httpHeaderAuth' });
    const list = vi.spyOn(client, 'list'),
      update = vi.spyOn(client, 'updateCredential'),
      create = vi.spyOn(client, 'createCredential');
    await expect(
      client.syncNamedCredential('naskah/embeddings', 'httpHeaderAuth', {}, 'personal'),
    ).rejects.toMatchObject({ code: 'credential_schema_mismatch' });
    request.mockRejectedValue(new N8nApiError(403));
    await expect(
      client.syncNamedCredential('naskah/embeddings', 'httpHeaderAuth', {}, 'personal'),
    ).rejects.toMatchObject({ code: 'n8n_unauthorized' });
    expect(list).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });
  it('creates a credential only when neither binding nor matching name exists', async () => {
    const client = new N8nClient('http://localhost:5683', 'in-memory-dummy');
    vi.spyOn(client, 'list').mockResolvedValue([]);
    const create = vi
      .spyOn(client, 'createCredential')
      .mockResolvedValue({ id: 'new', name: 'naskah/callback-bearer' });
    await expect(
      client.syncNamedCredential('naskah/callback-bearer', 'httpHeaderAuth', {}),
    ).resolves.toMatchObject({ id: 'new' });
    expect(create).toHaveBeenCalledOnce();
  });
});
