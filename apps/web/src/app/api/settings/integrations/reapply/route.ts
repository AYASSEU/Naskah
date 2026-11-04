import { ownerRoute, json } from '@/server/http/route';
import { reapplyIntegrations } from '@/server/integrations/credential-sync';
export async function POST(r: Request) {
  return ownerRoute(
    r,
    async (owner) => {
      await reapplyIntegrations(owner);
      return json({ ok: true });
    },
    'integration',
  );
}
