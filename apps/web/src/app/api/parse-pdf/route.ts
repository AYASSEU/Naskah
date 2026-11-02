import { ParseInputSchema } from '@naskah/contracts';
export async function POST(request: Request) {
  const result = ParseInputSchema.safeParse(await request.json().catch(() => null));
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
