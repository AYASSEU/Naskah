import 'server-only';
import type { IntegrationConfig, IntegrationId } from '@naskah/contracts';
import { AppError } from '../http/errors';
import { providerFetch, validateProviderUrl } from '../security/urls';
import { env } from '../config/env.server';
import { N8nClient } from '../n8n/client';

export interface ProviderDefinition {
  id: IntegrationId;
  label: string;
  defaults: IntegrationConfig;
  fields: { name: string; secret: boolean; required?: boolean }[];
  credentialName: string;
  credentialType: string;
  smokePath: string;
  toCredentialData: (key: string) => Record<string, string>;
  validate: (config: IntegrationConfig, key: string) => Promise<void>;
}
async function modelList(config: IntegrationConfig, key: string) {
  let response: Response;
  try {
    response = await providerFetch(config.baseUrl, 'models', key, env().ALLOW_LOCAL_PROVIDER_URLS);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('provider_unreachable', 502, true);
  }
  if (response.status === 401 || response.status === 403)
    throw new AppError('invalid_api_key', 400);
  if (response.status === 429) throw new AppError('rate_limited', 429, true);
  if (!response.ok) throw new AppError('provider_unreachable', 502, true);
  const body = (await response.json()) as { data?: { id?: string }[] };
  if (!Array.isArray(body.data) || !body.data.some((m) => m.id === config.model))
    throw new AppError('model_not_found', 400);
}
const providerFields = [
  { name: 'apiKey', secret: true, required: true },
  { name: 'baseUrl', secret: false },
  { name: 'model', secret: false },
];
export const providerRegistry: Record<IntegrationId, ProviderDefinition> = {
  deepseek: {
    id: 'deepseek',
    label: 'DeepSeek',
    defaults: {
      baseUrl: 'https://api.deepseek.com',
      model: 'deepseek-flash',
      dimensions: 1536,
      preset: 'deepseek',
    },
    fields: providerFields,
    credentialName: 'naskah/deepseek',
    credentialType: 'httpHeaderAuth',
    smokePath: 'naskah-smoke-deepseek',
    toCredentialData: (key) => ({ name: 'Authorization', value: `Bearer ${key}` }),
    validate: modelList,
  },
  embeddings: {
    id: 'embeddings',
    label: 'Embeddings',
    defaults: {
      baseUrl: 'https://api.openai.com/v1',
      model: 'text-embedding-3-small',
      dimensions: 1536,
      preset: 'openai',
    },
    fields: [...providerFields, { name: 'dimensions', secret: false }],
    credentialName: 'naskah/embeddings',
    credentialType: 'httpHeaderAuth',
    smokePath: 'naskah-smoke-embeddings',
    toCredentialData: (key) => ({ name: 'Authorization', value: `Bearer ${key}` }),
    async validate(config, key) {
      if (config.dimensions !== 1536) throw new AppError('embedding_dimension_mismatch');
      await modelList(config, key);
    },
  },
  n8n: {
    id: 'n8n',
    label: 'n8n',
    defaults: {
      baseUrl: 'http://localhost:5678',
      model: 'n8n',
      dimensions: 1536,
      preset: 'custom',
    },
    fields: [
      { name: 'apiKey', secret: true, required: true },
      { name: 'baseUrl', secret: false },
    ],
    credentialName: 'naskah/n8n',
    credentialType: 'httpHeaderAuth',
    smokePath: '',
    toCredentialData: (key) => ({ name: 'X-N8N-API-KEY', value: key }),
    async validate(config, key) {
      await validateProviderUrl(config.baseUrl, env().ALLOW_LOCAL_PROVIDER_URLS);
      await new N8nClient(config.baseUrl, key).request('workflows?limit=1');
    },
  },
};
export const internalRegistry = {
  'webhook-inbound': {
    name: 'naskah/webhook-inbound',
    type: 'httpHeaderAuth',
    data: () => ({ name: 'X-Naskah-Token', value: env().N8N_WEBHOOK_SECRET }),
  },
  'callback-bearer': {
    name: 'naskah/callback-bearer',
    type: 'httpHeaderAuth',
    data: () => ({ name: 'Authorization', value: `Bearer ${env().N8N_CALLBACK_SECRET}` }),
  },
  'supabase-rest': {
    name: 'naskah/supabase-rest',
    type: 'httpCustomAuth',
    data: () => ({
      json: JSON.stringify({
        headers: {
          apikey: env().SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env().SUPABASE_SERVICE_ROLE_KEY}`,
        },
      }),
    }),
  },
};
