import { IntegrationIdSchema } from '@naskah/contracts';
import { ownerRoute, json } from '@/server/http/route';
import { testIntegration } from '@/server/integrations/credential-sync';
export async function POST(r: Request, c: { params: Promise<{ id: string }> }) {
  return ownerRoute(
    r,
    async (owner) =>
      json(await testIntegration(owner, IntegrationIdSchema.parse((await c.params).id))),
    'integration',
  );
}
