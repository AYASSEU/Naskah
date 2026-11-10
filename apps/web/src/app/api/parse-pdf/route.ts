import { ownerRoute, json } from '@/server/http/route';
import { parseUpload } from '@/server/documents/parser';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  return ownerRoute(request, async () => json(await parseUpload(request)), 'parse');
}
