import { z } from 'zod';
import { evaluate } from '@/server/evaluation/engine';
import { AppError, errorResponse } from '@/server/http/errors';
import { json, readJson } from '@/server/http/route';
import { rateLimit } from '@/server/http/rate-limit';

const passage = z.string().trim().min(1).max(100000);
const input = z.object({ candidate: passage, reference: passage, language: z.enum(['id', 'en']) });
const report = z.object({
  results: z.tuple([z.object({ precision: z.number(), recall: z.number(), f1: z.number() })]),
});

export async function POST(request: Request) {
  try {
    const origin = new URL(request.headers.get('origin') ?? 'about:blank');
    if (
      !['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname) ||
      origin.host !== request.headers.get('host') ||
      request.headers.get('x-naskah-client') !== 'web'
    )
      throw new AppError('local_access_only', 403);
    rateLimit('local', 'manual-bertscore', 10);
    const { candidate, reference, language } = await readJson(request, input);
    const result = await evaluate(
      'bertscore',
      {
        data_scope: 'dev',
        pairs: [{ prediction: candidate, reference, language, reference_language: language }],
      },
      report,
    );
    return json(result.results[0]);
  } catch (error) {
    return errorResponse(error);
  }
}
