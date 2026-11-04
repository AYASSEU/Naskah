import { z } from 'zod';
const modeSchema = z.enum(['mock', 'live']).default('mock');
export function getEnvironment() {
  const result = modeSchema.safeParse(process.env.NEXT_PUBLIC_DATA_MODE);
  const mode = result.success ? result.data : 'live';
  return { mode } as const;
}
