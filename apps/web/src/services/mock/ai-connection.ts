import { z } from 'zod';
import {
  AiConnectionConfigSchema,
  AiConnectionSaveSchema,
  defaultAiConnection,
  type AiConnectionConfig,
} from '@naskah/contracts';
import type { AiConnectionService, PersistencePort } from '../ports';
import { PortError } from '../ports';

const storageKey = 'ai-connection';
const storedSchema = z.object({ version: z.literal(1), config: AiConnectionConfigSchema });

export function createMockAiConnection(persistence: PersistencePort) {
  let apiKey: string | undefined;
  let credentialTarget: string | undefined;
  const target = (config: AiConnectionConfig) => `${config.provider}:${config.baseUrl}`;
  async function readConfig() {
    const stored = await persistence.get<unknown>(storageKey);
    if (stored === undefined) return { ...defaultAiConnection };
    const result = storedSchema.safeParse(stored);
    if (!result.success) throw new PortError('schema_mismatch', true, 'schemaError');
    return result.data.config;
  }
  const snapshot = (config: AiConnectionConfig) => ({
    ...config,
    hasApiKey: !!apiKey && credentialTarget === target(config),
    credentialStorage: 'memory' as const,
  });
  const service: AiConnectionService = {
    async getSettings() {
      return snapshot(await readConfig());
    },
    async saveSettings(input) {
      const parsed = AiConnectionSaveSchema.safeParse(input);
      if (!parsed.success) throw new PortError('invalid_ai_settings', false, 'aiInvalidSettings');
      const config = AiConnectionConfigSchema.parse(parsed.data);
      // Persist an explicit allowlist: the credential must never reach IndexedDB.
      await persistence.set(storageKey, { version: 1, config });
      if (parsed.data.apiKey) {
        apiKey = parsed.data.apiKey;
        credentialTarget = target(config);
      } else if (credentialTarget !== target(config)) {
        apiKey = undefined;
        credentialTarget = undefined;
      }
      return snapshot(config);
    },
    async removeApiKey() {
      apiKey = undefined;
      credentialTarget = undefined;
      return snapshot(await readConfig());
    },
    async testConnection() {
      if (!(await service.getSettings()).hasApiKey)
        throw new PortError('ai_key_required', false, 'aiKeyRequired');
      await new Promise((resolve) => setTimeout(resolve, 450));
      return { mode: 'mock', status: 'simulated', checkedAt: new Date().toISOString() };
    },
  };
  return {
    ...service,
    async reset() {
      apiKey = undefined;
      credentialTarget = undefined;
      await persistence.set(storageKey, { version: 1, config: { ...defaultAiConnection } });
    },
  };
}
