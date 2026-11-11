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

describe('canonical binding recovery after deletion', () => {
  it('repairs owned names and types while preserving workflow identity and activation', async () => {
    const client = new N8nClient('http://localhost:5684', 'in-memory-dummy');
    vi.spyOn(client, 'list').mockImplementation(async (resource) =>
      resource === 'credentials'
        ? [{ id: 'new' }, { id: 'other' }]
        : [
            { id: 'owned', name: 'Naskah / Generate SRS' },
            { id: 'foreign', name: 'Personal workflow' },
          ],
    );
    const workflow = {
      id: 'owned',
      name: 'Naskah / Generate SRS',
      active: true,
      nodes: [
        {
          id: 'stable-node',
          name: 'LLM',
          position: [20, 40],
          credentials: {
            httpHeaderAuth: { id: 'deleted', name: 'naskah/deepseek' },
            httpBasicAuth: { id: 'other', name: 'naskah/deepseek' },
          },
        },
      ],
      connections: {},
      settings: {},
    };
    vi.spyOn(client, 'request').mockResolvedValue(structuredClone(workflow));
    const put = vi.spyOn(client, 'putWorkflow').mockResolvedValue({} as never),
      activate = vi.spyOn(client, 'activate').mockResolvedValue({} as never);
    expect(
      await client.rebindNamed('naskah/deepseek', 'httpHeaderAuth', {
        id: 'new',
        name: 'naskah/deepseek',
      }),
    ).toEqual([{ workflowId: 'owned', node: 'LLM' }]);
    expect(put.mock.calls[0]![0].nodes[0]).toMatchObject({
      id: 'stable-node',
      position: [20, 40],
      credentials: { httpHeaderAuth: { id: 'new' }, httpBasicAuth: { id: 'other' } },
    });
    expect(activate).toHaveBeenCalledExactlyOnceWith('owned');
    expect(client.request).toHaveBeenCalledExactlyOnceWith('workflows/owned');
  });
  it('does not rewrite current references and refuses foreign names', async () => {
    const client = new N8nClient('http://localhost:5685', 'in-memory-dummy');
    vi.spyOn(client, 'list').mockResolvedValue([{ id: 'owned', name: 'Naskah / Revise Section' }]);
    vi.spyOn(client, 'request').mockResolvedValue({
      id: 'owned',
      name: 'Naskah / Revise Section',
      nodes: [
        { name: 'LLM', credentials: { httpHeaderAuth: { id: 'new', name: 'naskah/deepseek' } } },
      ],
    });
    const put = vi.spyOn(client, 'putWorkflow');
    expect(
      await client.rebindNamed('naskah/deepseek', 'httpHeaderAuth', {
        id: 'new',
        name: 'naskah/deepseek',
      }),
    ).toEqual([]);
    expect(put).not.toHaveBeenCalled();
    await expect(
      client.rebindNamed('personal/key', 'httpHeaderAuth', { id: 'x', name: 'personal/key' }),
    ).rejects.toMatchObject({ code: 'credential_schema_mismatch' });
  });
});

it('defers activation until all credential references have been restored', async () => {
  const client = new N8nClient('http://localhost:5686', 'in-memory-dummy');
  vi.spyOn(client, 'list').mockImplementation(async (resource) =>
    resource === 'credentials' ? [{ id: 'new' }] : [{ id: 'owned', name: 'Naskah / Generate SRS' }],
  );
  vi.spyOn(client, 'request').mockResolvedValue({
    id: 'owned',
    name: 'Naskah / Generate SRS',
    active: true,
    nodes: [
      { name: 'LLM', credentials: { httpHeaderAuth: { id: 'deleted', name: 'naskah/deepseek' } } },
      {
        name: 'Embeddings',
        credentials: { httpHeaderAuth: { id: 'also-deleted', name: 'naskah/embeddings' } },
      },
    ],
    connections: {},
    settings: {},
  });
  const put = vi.spyOn(client, 'putWorkflow').mockResolvedValue({} as never),
    activate = vi.spyOn(client, 'activate');
  await expect(
    client.rebindNamed('naskah/deepseek', 'httpHeaderAuth', { id: 'new', name: 'naskah/deepseek' }),
  ).rejects.toMatchObject({ code: 'integration_not_ready' });
  expect(put).not.toHaveBeenCalled();
  expect(activate).not.toHaveBeenCalled();
});

it('repairs all orphaned owned sibling references before publishing an active workflow', async () => {
  const client = new N8nClient('http://localhost:5687', 'in-memory-dummy');
  vi.spyOn(client, 'list').mockImplementation(async (resource) =>
    resource === 'credentials'
      ? [
          { id: 'new', name: 'naskah/deepseek', type: 'httpHeaderAuth' },
          { id: 'embedding-new', name: 'naskah/embeddings', type: 'httpHeaderAuth' },
        ]
      : [{ id: 'owned', name: 'Naskah / Generate SRS' }],
  );
  vi.spyOn(client, 'request').mockResolvedValue({
    id: 'owned',
    name: 'Naskah / Generate SRS',
    active: true,
    nodes: [
      { name: 'LLM', credentials: { httpHeaderAuth: { id: 'deleted', name: 'naskah/deepseek' } } },
      {
        name: 'Embedding',
        credentials: { httpHeaderAuth: { id: 'also-deleted', name: 'naskah/embeddings' } },
      },
    ],
    settings: {},
    connections: {},
  });
  const put = vi.spyOn(client, 'putWorkflow').mockResolvedValue({} as never);
  vi.spyOn(client, 'activate').mockResolvedValue({} as never);
  await client.rebindNamed('naskah/deepseek', 'httpHeaderAuth', {
    id: 'new',
    name: 'naskah/deepseek',
  });
  expect(put.mock.calls[0]![0].nodes[1]!.credentials!.httpHeaderAuth!.id).toBe('embedding-new');
});
