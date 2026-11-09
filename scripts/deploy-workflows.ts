import { mkdir, writeFile } from "node:fs/promises";
import { deployWorkflows } from "../apps/web/src/server/n8n/deploy";
import { sql } from "../apps/web/src/server/db/client";
export async function deployProduction(appOverride?: string) {
  const deployed = await deployWorkflows(appOverride);
  await mkdir("artifacts", { recursive: true });
  await writeFile(
    "artifacts/b5-deployment.json",
    JSON.stringify(
      { at: new Date().toISOString(), workflows: deployed, secretScan: true },
      null,
      2,
    ),
  );
  console.log(
    "Generate SRS, Revise Section, Error Handler and Supabase smoke deployed; credential bindings and error routing verified.",
  );
  return deployed;
}
if (process.argv[1]?.replaceAll("\\", "/").endsWith("/deploy-workflows.ts"))
  deployProduction()
    .then(() => sql().end())
    .catch(async (error: unknown) => {
      console.error(
        (error as { code?: string }).code ?? "workflow_deployment_failed",
      );
      await sql().end();
      process.exitCode = 1;
    });
