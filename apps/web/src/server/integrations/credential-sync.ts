import 'server-only';
import {
  IntegrationConfigSchema,
  IntegrationSaveSchema,
  type IntegrationId,
  type IntegrationSave,
} from '@naskah/contracts';
import { db } from '../db/client';
import { env } from '../config/env.server';
import { AppError } from '../http/errors';
import { N8nApiError, type CredentialRef } from '../n8n/client';
import { ensureSmoke } from '../n8n/smoke';
import { providerRegistry, internalRegistry } from './registry';
import {
  audit,
  decryptSecret,
  integrationState,
  markIntegration,
  n8nClient,
  readSecret,
  storeSecret,
  withProviderLock,
} from './store';

async function bindCredential(
  owner: string,
  provider: string,
  name: string,
  type: string,
  data: Record<string, string>,
) {
  const client = await n8nClient(owner);
  const { data: binding, error } = await db()
    .from('n8n_bindings')
    .select('*')
    .eq('owner_id', owner)
    .eq('provider', provider)
    .maybeSingle();
  if (error) throw new AppError('internal_error', 500);
  let current: CredentialRef | undefined;
  if (binding?.credential_id) {
    try {
      current = await client.request<CredentialRef>(`credentials/${binding.credential_id}`);
    } catch (e) {
      if (!(e instanceof N8nApiError && e.httpStatus === 404)) throw e;
    }
  }
  const credential = current
    ? await client.updateCredential(current.id, name, type, data)
    : await client.createCredential(name, type, data);
  const rebound =
    binding?.credential_id && binding.credential_id !== credential.id
      ? await client.rebind(binding.credential_id, credential)
      : [];
  const { error: saveError } = await db().from('n8n_bindings').upsert({
    owner_id: owner,
    provider,
    credential_id: credential.id,
    credential_name: name,
    credential_type: type,
    rebound,
    status: 'synced',
    updated_at: new Date().toISOString(),
  });
  if (saveError) throw new AppError('internal_error', 500);
  return credential;
}
export async function bootstrapInternal(owner = env().LOCAL_OWNER_ID) {
  if (!(await readSecret(owner, 'n8n')) && env().N8N_API_KEY) {
    await storeSecret(owner, 'n8n', env().N8N_API_KEY!, {
      ...providerRegistry.n8n.defaults,
      baseUrl: env().N8N_BASE_URL,
    });
    await markIntegration(owner, 'n8n', 'ready');
  }
  const result: Record<string, CredentialRef> = {};
  for (const [id, def] of Object.entries(internalRegistry)) {
    result[id] = await withProviderLock(owner, id, async () => {
      const stored = await readSecret(owner, id);
      const data = stored
        ? (JSON.parse(decryptSecret(stored)) as Record<string, string>)
        : def.data();
      if (!stored) await storeSecret(owner, id, JSON.stringify(data), {});
      return bindCredential(owner, id, def.name, def.type, data);
    });
  }
  return result;
}
export async function saveIntegration(owner: string, id: IntegrationId, raw: IntegrationSave) {
  return withProviderLock(owner, id, async () => {
    const input = IntegrationSaveSchema.parse(raw),
      config = IntegrationConfigSchema.parse(input),
      def = providerRegistry[id];
    const previous = await readSecret(owner, id);
    if (
      previous &&
      !input.apiKey &&
      IntegrationConfigSchema.parse(previous.config).baseUrl !== config.baseUrl
    )
      throw new AppError('key_required_for_new_url');
    const key = input.apiKey ?? (previous ? decryptSecret(previous) : undefined);
    if (!key) throw new AppError('invalid_api_key');
    const started = Date.now();
    await def.validate(config, key);
    const validated = Date.now();
    await storeSecret(owner, id, key, config);
    if (id === 'n8n') {
      await markIntegration(owner, id, 'ready');
      await bootstrapInternal(owner);
      return integrationState(owner, id);
    }
    try {
      await markIntegration(owner, id, 'syncing');
      const client = await n8nClient(owner),
        internal = await bootstrapInternal(owner);
      const credential = await bindCredential(
        owner,
        id,
        def.credentialName,
        def.credentialType,
        def.toCredentialData(key),
      );
      await markIntegration(owner, id, 'binding');
      await ensureSmoke(client, id, config, credential, internal['webhook-inbound']!);
      await markIntegration(owner, id, 'synced');
      const { data } = await client.webhook(def.smokePath, env().N8N_WEBHOOK_SECRET, {}, 60000);
      if (!data || typeof data !== 'object' || !('ok' in data) || data.ok !== true)
        throw new AppError('provider_invalid_response', 502, true);
      await markIntegration(owner, id, 'ready');
      await audit(owner, 'integration_tested', id);
      return {
        ...(await integrationState(owner, id)),
        timings: { validate: validated - started, total: Date.now() - started },
      };
    } catch (error) {
      const failedAt = (await readSecret(owner, id))?.status ?? 'syncing';
      // Recover the last known credential value if an in-place update failed smoke.
      if (previous) {
        try {
          const credential = await bindCredential(
            owner,
            id,
            def.credentialName,
            def.credentialType,
            def.toCredentialData(decryptSecret(previous)),
          );
          const internal = await bootstrapInternal(owner);
          await ensureSmoke(
            await n8nClient(owner),
            id,
            IntegrationConfigSchema.parse(previous.config),
            credential,
            internal['webhook-inbound']!,
          );
        } catch {
          /* State below remains blocked until reapply succeeds. */
        }
      }
      await markIntegration(
        owner,
        id,
        `${failedAt}_failed`,
        error instanceof AppError ? error.code : 'stored_but_not_synced',
      );
      return integrationState(owner, id);
    }
  });
}
export async function testIntegration(owner: string, id: IntegrationId) {
  const row = await readSecret(owner, id);
  if (!row) throw new AppError('integration_not_ready', 409);
  return saveIntegration(owner, id, IntegrationSaveSchema.parse(row.config));
}
export async function deleteIntegration(owner: string, id: IntegrationId) {
  return withProviderLock(owner, id, async () => {
    const client = await n8nClient(owner),
      { data: binding } = await db()
        .from('n8n_bindings')
        .select('credential_id')
        .eq('owner_id', owner)
        .eq('provider', id)
        .maybeSingle();
    if (binding?.credential_id)
      await client.request(`credentials/${binding.credential_id}`, 'DELETE').catch((e) => {
        if (!(e instanceof N8nApiError && e.httpStatus === 404)) throw e;
      });
    const { error } = await db()
      .from('integration_secrets')
      .delete()
      .eq('owner_id', owner)
      .eq('provider', id);
    if (error) throw new AppError('internal_error', 500);
    await db().from('n8n_bindings').delete().eq('owner_id', owner).eq('provider', id);
    await audit(owner, 'integration_deleted', id);
    return integrationState(owner, id);
  });
}
export async function reapplyIntegrations(owner: string) {
  await bootstrapInternal(owner);
  for (const id of ['deepseek', 'embeddings'] as const)
    if (await readSecret(owner, id)) await testIntegration(owner, id);
}

// Startup recovery never spends provider tokens. Explicit Test/Reapply verifies the restored key.
export async function repairMissingCredentials(owner: string) {
  const internal = await bootstrapInternal(owner),
    client = await n8nClient(owner);
  const existing = await client.list<CredentialRef>('credentials');
  for (const id of ['deepseek', 'embeddings'] as const)
    await withProviderLock(owner, id, async () => {
      const row = await readSecret(owner, id);
      if (!row) return;
      const { data: binding } = await db()
        .from('n8n_bindings')
        .select('credential_id')
        .eq('owner_id', owner)
        .eq('provider', id)
        .maybeSingle();
      if (binding && existing.some((c) => c.id === binding.credential_id)) return;
      const def = providerRegistry[id],
        credential = await bindCredential(
          owner,
          id,
          def.credentialName,
          def.credentialType,
          def.toCredentialData(decryptSecret(row)),
        );
      await ensureSmoke(
        client,
        id,
        IntegrationConfigSchema.parse(row.config),
        credential,
        internal['webhook-inbound']!,
      );
      await markIntegration(owner, id, 'synced');
    });
}
