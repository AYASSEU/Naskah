import { AiConnectionSaveSchema } from '@naskah/contracts';

function unavailable() {
  return Response.json(
    { error: 'not_implemented', phase: 2, doc: 'docs/backend-roadmap.md' },
    { status: 501, headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function PUT(request: Request) {
  const result = AiConnectionSaveSchema.safeParse(await request.json().catch(() => null));
  if (!result.success) return Response.json({ error: 'invalid_ai_settings' }, { status: 400 });
  return unavailable();
}

export const GET = unavailable;
export const DELETE = unavailable;
