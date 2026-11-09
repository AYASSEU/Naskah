import "server-only";
import { access, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { env } from "../config/env.server";
import { sql } from "../db/client";
import { n8nClient } from "../integrations/store";
import { AppError } from "../http/errors";
import type { Workflow } from "./client";

async function workflowDirectory() {
  let directory = process.cwd();
  for (let level = 0; level < 5; level++) {
    try {
      await access(join(directory, "pnpm-workspace.yaml"));
      await access(join(directory, "n8n/workflows/generation.json"));
      return join(directory, "n8n/workflows");
    } catch {
      // Next.js may start from apps/web; continue toward the repository root.
    }
    const parent = dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }
  throw new AppError("config_missing", 503);
}
function substitute(
  value: unknown,
  replacements: Record<string, string>,
  code = false,
): unknown {
  if (typeof value === "string") {
    let text = value;
    for (const [marker, replacement] of Object.entries(replacements))
      text = code
        ? text.replaceAll(JSON.stringify(marker), JSON.stringify(replacement))
        : text.replaceAll(marker, replacement);
    return text;
  }
  if (Array.isArray(value))
    return value.map((item) => substitute(item, replacements));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        substitute(item, replacements, key === "jsCode"),
      ]),
    );
  return value;
}
export async function deployWorkflows(appOverride?: string) {
  const cfg = env(),
    client = await n8nClient(cfg.LOCAL_OWNER_ID),
    directory = await workflowDirectory();
  const app = appOverride ?? cfg.N8N_INTERNAL_APP_URL;
  for (const value of [app, cfg.N8N_INTERNAL_SUPABASE_URL]) {
    const url = new URL(value);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      throw new AppError("invalid_provider_url");
  }
  const replacements = {
    __NASKAH_APP_URL__: app,
    __NASKAH_SUPABASE_URL__: cfg.N8N_INTERNAL_SUPABASE_URL,
    __NASKAH_OWNER__: cfg.LOCAL_OWNER_ID,
  };
  const credentials = await client.list<{
    id: string;
    name: string;
    type: string;
  }>("credentials");
  const listed = await client.list<Workflow>("workflows");
  const deployed: Record<string, string> = {},
    bindings = new Map<string, { workflowId: string; node: string }[]>();
  for (const kind of ["error", "generation", "revision", "supabase"]) {
    const definition = JSON.parse(
      await readFile(join(directory, kind + ".json"), "utf8"),
    );
    const workflow = substitute(definition, replacements) as Workflow;
    if (JSON.stringify(workflow).includes("__NASKAH_"))
      throw new AppError("config_missing", 503);
    for (const node of workflow.nodes)
      for (const [type, ref] of Object.entries(node.credentials ?? {})) {
        const matches = credentials.filter(
          (c) => c.name === ref.name && c.type === type,
        );
        if (matches.length !== 1)
          throw new AppError(
            matches.length
              ? "credential_name_ambiguous"
              : "integration_not_ready",
            409,
          );
        node.credentials![type] = { id: matches[0]!.id, name: ref.name };
      }
    if (kind === "generation" || kind === "revision")
      workflow.settings.errorWorkflow = deployed.error;
    const matching = listed.filter((w) => w.name === workflow.name);
    if (matching.length > 1) throw new AppError("integration_not_ready", 409);
    if (matching[0]?.id) {
      const old = await client.request<Workflow>(`workflows/${matching[0].id}`);
      workflow.id = old.id;
      if (
        old.nodes.some(
          (n) =>
            !workflow.nodes.some(
              (next) => next.name === n.name && next.type === n.type,
            ),
        )
      )
        throw new AppError("integration_not_ready", 409);
      const remapped = new Map<string, string>();
      for (const node of workflow.nodes) {
        const prior = old.nodes.find(
          (n) => n.name === node.name && n.type === node.type,
        );
        if (prior) {
          remapped.set(node.id, prior.id);
          node.id = prior.id;
          node.position = prior.position;
        }
      }
      const priorGroups = (old.nodeGroups ?? []) as {
        id: string;
        name: string;
        nodeIds: string[];
      }[];
      workflow.nodeGroups = (
        (workflow.nodeGroups ?? []) as {
          id: string;
          name: string;
          nodeIds: string[];
        }[]
      ).map((group) => ({
        ...group,
        id: priorGroups.find((g) => g.name === group.name)?.id ?? group.id,
        nodeIds: group.nodeIds.map((id) => remapped.get(id) ?? id),
      }));
      workflow.settings.availableInMCP = old.settings.availableInMCP ?? false;
    }
    const published = JSON.stringify(workflow);
    for (const secret of [
      cfg.N8N_API_KEY,
      cfg.N8N_WEBHOOK_SECRET,
      cfg.N8N_CALLBACK_SECRET,
      cfg.SUPABASE_SERVICE_ROLE_KEY,
      cfg.APP_ENCRYPTION_KEY,
    ])
      if (secret && published.includes(secret))
        throw new AppError("invalid_input");
    const saved = await client.putWorkflow(workflow);
    if (!saved.id) throw new AppError("n8n_unreachable", 502);
    await client.activate(saved.id);
    deployed[kind] = saved.id;
    const actual = await client.request<Workflow>(`workflows/${saved.id}`);
    if (
      !actual.active ||
      actual.settings.saveDataErrorExecution !== "none" ||
      ((kind === "generation" || kind === "revision") &&
        actual.settings.errorWorkflow !== deployed.error)
    )
      throw new AppError("integration_not_ready", 502);
    for (const node of actual.nodes)
      for (const ref of Object.values(node.credentials ?? {})) {
        const provider = ref.name.slice("naskah/".length),
          refs = bindings.get(provider) ?? [];
        refs.push({ workflowId: saved.id, node: node.name });
        bindings.set(provider, refs);
      }
  }
  for (const [provider, refs] of bindings)
    await sql()`update public.n8n_bindings set workflows=${JSON.stringify(refs)}::text::jsonb,updated_at=now() where owner_id=${cfg.LOCAL_OWNER_ID} and provider=${provider}`;
  return deployed;
}
