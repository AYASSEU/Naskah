import 'server-only';
import { ZodError } from 'zod';
export class AppError extends Error {
  constructor(public code: string, public status = 400, public retryable = false, public detail?: Record<string, unknown>) { super(code); }
}
export function errorResponse(error: unknown) {
  const known = error instanceof AppError ? error : error instanceof ZodError ? new AppError('invalid_input') : new AppError('internal_error',500,true);
  return Response.json({ code: known.code, retryable: known.retryable, userMessageKey: `backendErrors.${known.code}`, ...(known.detail ? {detail:known.detail} : {}) }, { status: known.status, headers: {'Cache-Control':'no-store'} });
}
