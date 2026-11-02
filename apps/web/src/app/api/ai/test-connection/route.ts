export async function POST() {
  return Response.json(
    { error: 'not_implemented', phase: 2, doc: 'docs/backend-roadmap.md' },
    { status: 501, headers: { 'Cache-Control': 'no-store' } },
  );
}
