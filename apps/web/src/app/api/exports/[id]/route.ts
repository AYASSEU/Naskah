import { ownerRoute } from '@/server/http/route';
import { downloadExport } from '@/server/documents/compiler';
export const runtime = 'nodejs';
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return ownerRoute(request, async (owner) => downloadExport(owner, (await context.params).id));
}
