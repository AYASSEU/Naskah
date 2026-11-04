import { IntegrationIdSchema, IntegrationSaveSchema } from '@naskah/contracts';
import { ownerRoute, json, readJson } from '@/server/http/route';
import { integrationState } from '@/server/integrations/store';
import { saveIntegration, deleteIntegration } from '@/server/integrations/credential-sync';
type Context = { params: Promise<{ id: string }> };
export async function GET(r: Request, c: Context) {
  return ownerRoute(r, async (owner) =>
    json(await integrationState(owner, IntegrationIdSchema.parse((await c.params).id))),
  );
}
export async function PUT(r: Request, c: Context) {
  return ownerRoute(
    r,
    async (owner) =>
      json(
        await saveIntegration(
          owner,
          IntegrationIdSchema.parse((await c.params).id),
          await readJson(r, IntegrationSaveSchema, 16384),
        ),
      ),
    'integration',
  );
}
export async function DELETE(r: Request, c: Context) {
  return ownerRoute(
    r,
    async (owner) =>
      json(await deleteIntegration(owner, IntegrationIdSchema.parse((await c.params).id))),
    'integration',
  );
}
