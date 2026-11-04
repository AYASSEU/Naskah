import { z } from 'zod';

export const BackendErrorCodes = [
  'key_required_for_new_url',
  'config_missing',
  'integration_not_ready',
  'embedding_dimension_mismatch',
  'embedding_model_mismatch',
  'knowledge_base_empty',
  'retrieval_failed',
  'llm_unauthorized',
  'llm_rate_limited',
  'llm_timeout',
  'llm_invalid_output',
  'guardrail_failed',
  'callback_failed',
  'cancelled',
  'unknown',
  'invalid_input',
  'invalid_api_key',
  'model_not_found',
  'provider_unreachable',
  'rate_limited',
  'invalid_provider_url',
  'n8n_unreachable',
  'n8n_unauthorized',
  'credential_schema_mismatch',
  'stored_but_not_synced',
  'section_changed',
  'section_locked',
  'revision_pending',
  'revision_not_ready',
  'not_found',
  'unauthorized',
  'cross_origin_request',
  'local_access_only',
  'stale_callback',
  'internal_error',
  'too_large',
  'no_text_layer',
  'invalid_file',
  'parse_timeout',
  'compiler_unavailable',
  'research_consent_required',
  'dev_seed_excluded',
  'language_mismatch',
  'provider_invalid_response',
  'timeout',
  'callback_conflict',
  'run_not_active',
] as const;
export const BackendErrorSchema = z.object({
  code: z.string(),
  retryable: z.boolean(),
  userMessageKey: z.string(),
  detail: z.record(z.string(), z.unknown()).optional(),
});
export const IntegrationIdSchema = z.enum(['deepseek', 'embeddings', 'n8n']);
export type IntegrationId = z.infer<typeof IntegrationIdSchema>;
export const IntegrationConfigSchema = z.object({
  baseUrl: z.url(),
  model: z.string().trim().min(1).max(128).default('deepseek-flash'),
  dimensions: z.number().int().positive().max(65536).default(1536),
  preset: z.enum(['deepseek', 'openai', 'custom']).default('custom'),
});
export type IntegrationConfig = z.infer<typeof IntegrationConfigSchema>;
export const IntegrationSaveSchema = IntegrationConfigSchema.extend({
  apiKey: z.string().trim().min(8).max(4096).regex(/^\S+$/).optional(),
});
export type IntegrationSave = z.infer<typeof IntegrationSaveSchema>;
export const IntegrationStateSchema = z.object({
  id: IntegrationIdSchema,
  label: z.string(),
  config: IntegrationConfigSchema,
  configured: z.boolean(),
  key_hint: z.string().max(4),
  stored: z.boolean(),
  synced: z.boolean(),
  tested: z.boolean(),
  last_tested_at: z.string().nullable(),
  updated_at: z.string().nullable(),
  error_code: z.string().nullable(),
  step: z.enum(['validate', 'store', 'sync', 'bind', 'test', 'ready']).optional(),
  timings: z.record(z.string(), z.number()).optional(),
});
export type IntegrationState = z.infer<typeof IntegrationStateSchema>;
export const SystemStatusSchema = z.object({
  ready: z.boolean(),
  reasons: z.array(z.object({ code: z.string(), integration: z.string(), href: z.string() })),
  integrations: z.array(IntegrationStateSchema),
  workflows: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      active: z.boolean(),
      version: z.string().optional(),
    }),
  ),
  knowledge: z.object({
    count: z.number(),
    datasets: z.record(z.string(), z.number()),
    model: z.string().nullable(),
    dimensions: z.number(),
    devOnly: z.boolean(),
    lastIngestion: z.string().nullable(),
  }),
});
export type SystemStatus = z.infer<typeof SystemStatusSchema>;
export const ParticipantSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_-]{3,40}$/),
  consent: z.literal(true),
  role: z.enum(['expert', 'participant']),
});
export const CallbackBaseSchema = z.object({
  event_id: z.uuid(),
  session_id: z.uuid(),
  sent_at: z.iso.datetime(),
  run_id: z.uuid().optional(),
});
export const AcceptedSchema = z.object({
  accepted: z.literal(true),
  session_id: z.uuid(),
  execution_id: z.string(),
});
export const FailureCallbackSchema = CallbackBaseSchema.extend({
  stage: z.string(),
  code: z.string(),
  retryable: z.boolean(),
  revision_id: z.uuid().optional(),
  completed_sections: z.array(z.unknown()).optional(),
});
