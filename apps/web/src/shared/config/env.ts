import { z } from 'zod';
const modeSchema = z.enum(['mock', 'live']).default('mock');
const serverSchema = z.object({
  N8N_BASE_URL: z.url(),
  N8N_WEBHOOK_SECRET: z.string().min(1),
  SUPABASE_URL: z.url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  DEEPSEEK_API_KEY: z.string().min(1),
});
export function getEnvironment() {
  const result = modeSchema.safeParse(process.env.NEXT_PUBLIC_DATA_MODE);
  const mode = result.success ? result.data : 'live';
  return { mode } as const;
}
export function serverConfigured() {
  return serverSchema.safeParse(
    Object.fromEntries(Object.keys(serverSchema.shape).map((key) => [key, process.env[key]])),
  ).success;
}
