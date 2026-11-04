import 'server-only';
import {
  IntegrationConfigSchema,
  type IntegrationId,
  type IntegrationState,
} from '@naskah/contracts';
import { env } from '../config/env.server';
import { db, sql } from '../db/client';
import { seal, unseal, type Envelope } from '../security/envelope';
import { registerSecret } from '../security/redact';
import { AppError } from '../http/errors';
import { providerRegistry } from './registry';
import { N8nClient } from '../n8n/client';

export async function readSecret(owner: string, provider: string) {
  const { data, error } = await db()
    .from('integration_secrets')
    .select('*')
    .eq('owner_id', owner)
    .eq('provider', provider)
    .maybeSingle();
  if (error) throw new AppError('internal_error', 500, true);
  return data;
}
export function decryptSecret(row: Envelope & { provider: string; owner_id: string }) {
  const cfg = env(),
    value = unseal(row, row.provider, row.owner_id, {
      [cfg.APP_KEY_VERSION]: cfg.APP_ENCRYPTION_KEY,
    });
  registerSecret(value);
  return value;
}
export async function storeSecret(
  owner: string,
  provider: string,
  key: string,
  config: Record<string, unknown>,
) {
  registerSecret(key);
  const envelope = seal(key, provider, owner, env().APP_ENCRYPTION_KEY, env().APP_KEY_VERSION);
  const { error } = await db()
    .from('integration_secrets')
    .upsert({
      ...envelope,
      owner_id: owner,
      provider,
      config: JSON.parse(JSON.stringify(config)),
      status: 'stored',
      last_error_code: null,
      last_tested_at: null,
      updated_at: new Date().toISOString(),
    });
  if (error) throw new AppError('internal_error', 500, true);
  await audit(owner, 'integration_saved', provider);
}
export async function audit(
  owner: string,
  action: string,
  resource: string,
  detail: Record<string, string | number | boolean> = {},
) {
  const { error } = await db()
    .from('audit_log')
    .insert({ owner_id: owner, action, resource, detail });
  if (error) throw new AppError('internal_error', 500, true);
}
export async function markIntegration(
  owner: string,
  provider: string,
  status: string,
  errorCode: string | null = null,
) {
  const { error } = await db()
    .from('integration_secrets')
    .update({
      status,
      last_error_code: errorCode,
      ...(status === 'ready' ? { last_tested_at: new Date().toISOString() } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('owner_id', owner)
    .eq('provider', provider);
  if (error) throw new AppError('internal_error', 500, true);
}
export async function integrationState(
  owner: string,
  id: IntegrationId,
): Promise<IntegrationState> {
  const row = await readSecret(owner, id),
    def = providerRegistry[id];
  return {
    id,
    label: def.label,
    config: row ? IntegrationConfigSchema.parse(row.config) : def.defaults,
    configured: !!row,
    key_hint: row?.key_hint ?? '',
    stored: !!row,
    synced: row?.status === 'ready' || row?.status === 'synced',
    tested: row?.status === 'ready',
    last_tested_at: row?.last_tested_at ?? null,
    updated_at: row?.updated_at ?? null,
    error_code: row?.last_error_code ?? null,
    step:
      row?.status === 'ready'
        ? 'ready'
        : row?.status.startsWith('synced')
          ? 'test'
          : row?.status.startsWith('binding')
            ? 'bind'
            : row?.status.startsWith('syncing')
              ? 'sync'
              : 'store',
  };
}
export async function n8nClient(owner = env().LOCAL_OWNER_ID) {
  const row = await readSecret(owner, 'n8n');
  const key = row ? decryptSecret(row) : env().N8N_API_KEY;
  if (!key) throw new AppError('config_missing', 503);
  return new N8nClient(
    row ? IntegrationConfigSchema.parse(row.config).baseUrl : env().N8N_BASE_URL,
    key,
  );
}
export async function withProviderLock<T>(
  owner: string,
  provider: string,
  operation: () => Promise<T>,
) {
  const connection = await sql().reserve();
  let locked = false;
  try {
    await connection`set lock_timeout = '30s'`;
    await connection`select pg_advisory_lock(hashtextextended(${`${owner}:${provider}`},0))`;
    locked = true;
    return await operation();
  } finally {
    try {
      if (locked)
        await connection`select pg_advisory_unlock(hashtextextended(${`${owner}:${provider}`},0))`;
      await connection`reset lock_timeout`;
    } finally {
      connection.release();
    }
  }
}
