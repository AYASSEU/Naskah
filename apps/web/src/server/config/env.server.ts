import 'server-only';
import { z } from 'zod';

const bool = (fallback: boolean) => z.preprocess((v) => v === undefined ? fallback : v === 'true', z.boolean());
export const ServerEnvSchema = z.object({
  APP_BASE_URL: z.url().default('http://localhost:3000'),
  APP_ENCRYPTION_KEY: z.string().refine((s) => /^[A-Za-z0-9+/]{43}=$/.test(s) && Buffer.from(s, 'base64').length === 32, 'must be a base64-encoded 32-byte key'),
  APP_KEY_VERSION: z.coerce.number().int().positive().default(1),
  LOCAL_OWNER_ID: z.uuid(),
  SUPABASE_URL: z.url(), SUPABASE_SERVICE_ROLE_KEY: z.string().min(1), DATABASE_URL: z.string().min(1),
  N8N_BASE_URL: z.url().default('http://localhost:5678'), N8N_API_KEY: z.string().optional(),
  N8N_WEBHOOK_SECRET: z.string().min(32), N8N_CALLBACK_SECRET: z.string().min(32),
  N8N_INTERNAL_APP_URL: z.url().default('http://host.docker.internal:3000'),
  N8N_INTERNAL_SUPABASE_URL: z.url().default('http://host.docker.internal:54321'),
  COMPILER_SERVICE_URL: z.url().default('http://localhost:8000'),
  COMPILER_MODE: z.enum(['server','client']).default('server'),
  ALLOW_LOCAL_PROVIDER_URLS: bool(process.env.NODE_ENV !== 'production'),
  ENABLE_DEVTOOLS: bool(false),
  GENERATION_IDLE_TIMEOUT_MS: z.coerce.number().int().positive().default(180000),
  GENERATION_MAX_TIMEOUT_MS: z.coerce.number().int().positive().default(900000),
});
export type ServerEnv = z.infer<typeof ServerEnvSchema>;
export function serverConfigured() { return ServerEnvSchema.safeParse(process.env).success; }
let cached: ServerEnv | undefined;
export function env(): ServerEnv {
  if (cached) return cached;
  const parsed = ServerEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    // Only field names; Zod's input object must never be logged.
    throw new Error(`config_missing: ${[...new Set(parsed.error.issues.map((i) => i.path.join('.')))].join(', ')}`);
  }
  cached = parsed.data;
  return cached;
}
