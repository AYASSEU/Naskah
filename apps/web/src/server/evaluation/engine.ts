import 'server-only';
import { z } from 'zod';
import { env } from '../config/env.server';
import { AppError } from '../http/errors';
export async function evaluate<T>(
  operation: string,
  input: unknown,
  schema: z.ZodType<T>,
): Promise<T> {
  const cfg = env();
  if (!cfg.EVALUATION_SERVICE_TOKEN) throw new AppError('evaluation_unavailable', 503, true);
  try {
    const response = await fetch(new URL('/evaluate', cfg.EVALUATION_SERVICE_URL), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.EVALUATION_SERVICE_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ operation, input }),
      signal: AbortSignal.timeout(50000),
      cache: 'no-store',
      redirect: 'error',
    });
    const data = await response.json();
    if (!response.ok) {
      const code = z
        .object({
          error: z.enum([
            'invalid_input',
            'language_mismatch',
            'dev_seed_excluded',
            'invalid_stemmer_language',
            'evaluation_too_large',
            'insufficient_samples',
            'study_design_required',
            'pairing_mismatch',
            'independent_groups_overlap',
            'duplicate_observation',
            'statistics_undefined',
            'evaluation_timeout',
            'evaluation_busy',
            'evaluation_failed',
          ]),
        })
        .safeParse(data);
      throw new AppError(
        code.success ? code.data.error : 'evaluation_failed',
        response.status >= 500 ? 503 : 422,
        response.status >= 500,
      );
    }
    return schema.parse(data);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('evaluation_unavailable', 503, true);
  }
}
