import 'server-only';
import { z } from 'zod';
import { env } from '../config/env.server';
import { AppError } from '../http/errors';
export async function documentService(path: string, body?: BodyInit, type = 'application/json') {
  const cfg = env();
  if (!cfg.COMPILER_SERVICE_TOKEN) throw new AppError('compiler_unavailable', 503, true);
  try {
    const response = await fetch(new URL(path, cfg.COMPILER_SERVICE_URL), {
      method: body ? 'POST' : 'GET',
      headers: {
        Authorization: `Bearer ${cfg.COMPILER_SERVICE_TOKEN}`,
        ...(body ? { 'Content-Type': type } : {}),
      },
      body,
      signal: AbortSignal.timeout(path === '/compile' ? 100000 : 25000),
      cache: 'no-store',
      redirect: 'error',
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      const code = z
        .object({
          error: z.enum([
            'too_large',
            'page_limit',
            'no_text_layer',
            'encrypted_pdf',
            'invalid_file',
            'invalid_input',
            'unsafe_document',
            'document_timeout',
            'document_busy',
            'compiler_failed',
          ]),
        })
        .safeParse(payload);
      throw new AppError(
        code.success ? code.data.error : 'compiler_unavailable',
        response.status >= 500 ? 503 : response.status,
        response.status >= 500,
      );
    }
    return response;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('compiler_unavailable', 503, true);
  }
}
export const HealthSchema = z.object({
  ok: z.literal(true),
  compiler_id: z.string().min(1),
  font: z.string(),
  pandoc: z.string(),
  libreoffice: z.string(),
});
