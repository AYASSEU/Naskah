import { ownerRoute, json } from '@/server/http/route';
import { systemStatus } from '@/server/integrations/status';
export async function GET(r: Request) {
  return ownerRoute(r, async (owner) => json(await systemStatus(owner)));
}
