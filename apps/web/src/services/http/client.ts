import { z } from 'zod';
import { BackendErrorSchema } from '@naskah/contracts';
import { PortError } from '../ports';
let session: Promise<void> | undefined;
export async function ensureSession() {
  session ??= fetch('/api/auth/session', {
    credentials: 'same-origin',
    headers: { 'X-Naskah-Client': 'web' },
  })
    .then(async (r) => {
      if (!r.ok) await throwResponse(r);
    })
    .catch((error) => {
      session = undefined;
      throw error;
    });
  return session;
}
async function throwResponse(response: Response): Promise<never> {
  const parsed = BackendErrorSchema.safeParse(await response.json().catch(() => null));
  throw parsed.success
    ? new PortError(parsed.data.code, parsed.data.retryable, parsed.data.userMessageKey)
    : new PortError('unknown', true, 'backendErrors.unknown');
}
export async function request<T>(
  path: string,
  schema: z.ZodType<T>,
  init: RequestInit = {},
  retry = true,
): Promise<T> {
  await ensureSession();
  const response = await fetch(path, {
    ...init,
    credentials: 'same-origin',
    headers: {
      'X-Naskah-Client': 'web',
      ...(init.body && typeof init.body === 'string' ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });
  if (response.status === 401 && retry) {
    session = undefined;
    return request(path, schema, init, false);
  }
  if (!response.ok) return throwResponse(response);
  return schema.parse(response.status === 204 ? undefined : await response.json());
}
