import { ReadyCallbackSchema } from '@naskah/contracts';
// Phase 2: authenticate webhook signature, then deduplicate by session_id.
// Repeated delivery must not create another version or generation log.
export async function POST(request: Request) {
  const result = ReadyCallbackSchema.safeParse(await request.json().catch(() => null));
  if (!result.success)
    return Response.json(
      { error: 'invalid_request', issues: result.error.issues },
      { status: 400 },
    );
  return Response.json(
    { error: 'not_implemented', phase: 2, doc: 'docs/backend-roadmap.md' },
    { status: 501 },
  );
}
