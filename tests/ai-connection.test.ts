import { describe, expect, it, vi } from 'vitest';
import {
  AiConnectionSaveSchema,
  AiConnectionSnapshotSchema,
  AiConnectionTestSchema,
  defaultAiConnection,
} from '@naskah/contracts';
import type { PersistencePort } from '@/services/ports';
import { createMockAiConnection } from '@/services/mock/ai-connection';
import { createHttpServices } from '@/services/http';
import { GET, PUT, DELETE } from '@/app/api/ai/settings/route';
import { POST } from '@/app/api/ai/test-connection/route';

const testKey = 'example-key-for-tests-only';
function setup() {
  const values = new Map<string, unknown>();
  const persistence: PersistencePort = {
    async get<T>(key: string) {
      return structuredClone(values.get(key)) as T | undefined;
    },
    async set<T>(key: string, value: T) {
      values.set(key, structuredClone(value));
    },
    async clear() {
      values.clear();
    },
  };
  return { values, persistence, service: createMockAiConnection(persistence) };
}

describe('AI connection boundary', () => {
  it('validates write requests and rejects unsafe URLs and malformed fields', () => {
    for (const baseUrl of [
      'http://api.example.com',
      'https://user:pass@api.example.com',
      'https://api.example.com?key=secret',
      'https://api.example.com#key',
    ]) {
      expect(AiConnectionSaveSchema.safeParse({ ...defaultAiConnection, baseUrl }).success).toBe(
        false,
      );
    }
    expect(AiConnectionSaveSchema.safeParse({ ...defaultAiConnection, model: ' ' }).success).toBe(
      false,
    );
    expect(
      AiConnectionSaveSchema.safeParse({ ...defaultAiConnection, apiKey: 'short' }).success,
    ).toBe(false);
    expect(
      AiConnectionSaveSchema.safeParse({ ...defaultAiConnection, apiKey: 'key with spaces' })
        .success,
    ).toBe(false);
  });
  it('persists only public configuration and forgets the key after a new tab session', async () => {
    const { values, persistence, service } = setup();
    const saved = await service.saveSettings({ ...defaultAiConnection, apiKey: testKey });
    expect(AiConnectionSnapshotSchema.parse(saved).hasApiKey).toBe(true);
    expect(JSON.stringify(saved)).not.toContain(testKey);
    expect(JSON.stringify([...values.values()])).not.toContain(testKey);
    expect((await service.getSettings()).hasApiKey).toBe(true);
    expect((await createMockAiConnection(persistence).getSettings()).hasApiKey).toBe(false);
  });
  it('requires a key and labels simulated tests without calling the provider', async () => {
    const { service } = setup();
    await expect(service.testConnection()).rejects.toMatchObject({ code: 'ai_key_required' });
    await service.saveSettings({ ...defaultAiConnection, apiKey: testKey });
    const fetch = vi.spyOn(globalThis, 'fetch');
    try {
      expect(AiConnectionTestSchema.parse(await service.testConnection())).toMatchObject({
        mode: 'mock',
        status: 'simulated',
      });
      expect(fetch).not.toHaveBeenCalled();
      expect(
        AiConnectionTestSchema.safeParse({
          mode: 'mock',
          status: 'connected',
          checkedAt: new Date().toISOString(),
        }).success,
      ).toBe(false);
    } finally {
      fetch.mockRestore();
    }
  });
  it('invalidates a key when the destination changes, supports replacement and removal', async () => {
    const { service } = setup();
    await service.saveSettings({ ...defaultAiConnection, apiKey: testKey });
    expect(
      (await service.saveSettings({ ...defaultAiConnection, model: 'another-model' })).hasApiKey,
    ).toBe(true);
    const custom = {
      ...defaultAiConnection,
      provider: 'custom' as const,
      baseUrl: 'https://example.com/v1',
    };
    expect((await service.saveSettings(custom)).hasApiKey).toBe(false);
    expect((await service.saveSettings({ ...custom, apiKey: testKey })).hasApiKey).toBe(true);
    expect((await service.removeApiKey()).hasApiKey).toBe(false);
    await service.saveSettings({ ...custom, apiKey: testKey });
    await service.reset();
    expect(await service.getSettings()).toMatchObject({ ...defaultAiConnection, hasApiKey: false });
  });
  it('recovers corrupted configuration via reset and keeps failed writes atomic', async () => {
    const { service, values, persistence } = setup();
    values.set('ai-connection', { version: 7 });
    await expect(service.getSettings()).rejects.toMatchObject({ code: 'schema_mismatch' });
    await service.reset();
    const set = vi.spyOn(persistence, 'set').mockRejectedValueOnce(new Error('quota'));
    await expect(service.saveSettings({ ...defaultAiConnection, apiKey: testKey })).rejects.toThrow(
      'quota',
    );
    expect((await service.getSettings()).hasApiKey).toBe(false);
    set.mockRestore();
  });
  it('returns 400 for invalid requests and 501 placeholders without reflecting credentials', async () => {
    const request = (body: unknown) =>
      new Request('http://localhost/api/ai/settings', {
        method: 'PUT',
        body: JSON.stringify(body),
      });
    expect((await PUT(request({ apiKey: testKey }))).status).toBe(400);
    const response = await PUT(request({ ...defaultAiConnection, apiKey: testKey }));
    expect(response.status).toBe(501);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.text()).not.toContain(testKey);
    for (const handler of [GET, DELETE, POST]) expect((await handler()).status).toBe(501);
    await expect(createHttpServices().aiConnection.getSettings()).rejects.toMatchObject({
      code: 'not_implemented',
    });
  });
});
