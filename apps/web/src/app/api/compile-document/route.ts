import { CompileInputSchema } from '@naskah/contracts';
import { ownerRoute, readJson, json } from '@/server/http/route';
import { compileDocument } from '@/server/documents/compiler';
export const runtime = 'nodejs';
export const maxDuration = 120;
export async function POST(request: Request) {
  return ownerRoute(
    request,
    async (owner) =>
      json(await compileDocument(owner, await readJson(request, CompileInputSchema))),
    'compile',
  );
}
