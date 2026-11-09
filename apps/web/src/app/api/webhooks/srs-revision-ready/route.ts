import { callbackRoute } from '@/server/workflows/callbacks';
export async function POST(request: Request) {
  return callbackRoute(request, 'revision');
}
