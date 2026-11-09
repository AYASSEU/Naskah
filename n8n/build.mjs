import { build } from "esbuild";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const directory = dirname(fileURLToPath(import.meta.url));
export async function buildRendererCode() {
  const schema = JSON.parse(
    await readFile(resolve(directory, "schemas/chapter-draft.json"), "utf8"),
  );
  const supported = new Set([
    "$schema",
    "type",
    "properties",
    "required",
    "items",
    "minItems",
    "maxItems",
    "enum",
    "minLength",
    "maxLength",
    "pattern",
    "additionalProperties",
    "default",
  ]);
  function checkSchema(value) {
    for (const key of Object.keys(value))
      if (!supported.has(key))
        throw new Error(`Unsupported chapter JSON Schema keyword: ${key}`);
    for (const child of Object.values(value.properties ?? {}))
      checkSchema(child);
    if (value.items) checkSchema(value.items);
  }
  checkSchema(schema);
  const output = await build({
    entryPoints: [resolve(directory, "src/render-manuscript.ts")],
    bundle: true,
    write: false,
    format: "iife",
    platform: "browser",
    target: "es2022",
    minify: true,
    legalComments: "none",
    charset: "utf8",
  });
  const bundled = output.outputFiles[0].text;
  if (/Object\.definePropert(?:y|ies)/.test(bundled))
    throw new Error(
      "Bundle requires property-definition APIs disabled by the n8n sandbox.",
    );
  return (
    "const __naskahResult = { items: undefined };\n" +
    bundled +
    "\nreturn __naskahResult.items;"
  );
}

export function rendererWorkflow(jsCode) {
  return {
    name: "Naskah / Smoke / Markdown",
    nodes: [
      {
        id: "markdown-webhook",
        name: "Authenticated chapter input",
        type: "n8n-nodes-base.webhook",
        typeVersion: 2.2,
        position: [0, 200],
        parameters: {
          httpMethod: "POST",
          path: "naskah-smoke-markdown",
          authentication: "headerAuth",
          responseMode: "lastNode",
          options: {},
        },
        credentials: { httpHeaderAuth: { name: "naskah/webhook-inbound" } },
      },
      {
        id: "markdown-renderer",
        name: "Validate and render shared Markdown",
        type: "n8n-nodes-base.code",
        typeVersion: 2,
        position: [340, 200],
        parameters: {
          mode: "runOnceForAllItems",
          language: "javaScript",
          jsCode,
        },
      },
    ],
    connections: {
      "Authenticated chapter input": {
        main: [
          [
            {
              node: "Validate and render shared Markdown",
              type: "main",
              index: 0,
            },
          ],
        ],
      },
    },
    nodeGroups: [
      {
        id: "markdown-contract",
        name: "Shared Markdown contract",
        description:
          "Validate chapter JSON and run the same renderer used by the web application.",
        nodeIds: ["markdown-renderer"],
      },
    ],
    settings: {
      executionOrder: "v1",
      timezone: "Asia/Jakarta",
      executionTimeout: 120,
      saveDataErrorExecution: "none",
      saveDataSuccessExecution: "none",
      saveManualExecutions: false,
      availableInMCP: false,
    },
  };
}

export function rendererSdkCode(jsCode) {
  return `const inbound = trigger({type:'n8n-nodes-base.webhook',version:2.2,config:{name:'Authenticated chapter input',parameters:{httpMethod:'POST',path:'naskah-smoke-markdown',authentication:'headerAuth',responseMode:'lastNode',options:{}},credentials:{httpHeaderAuth:newCredential('naskah/webhook-inbound')}},output:[{body:{chapters:[]}}]});
const render = node({type:'n8n-nodes-base.code',version:2,config:{name:'Validate and render shared Markdown',parameters:{mode:'runOnceForAllItems',language:'javaScript',jsCode:${JSON.stringify(jsCode)}}},output:[{ok:true,markdown:'# 1. Introduction\\n'}]});
export default workflow('naskah-smoke-markdown','Naskah / Smoke / Markdown').add(inbound).to(render).group('Shared Markdown contract',[render],{description:'Validate chapter JSON and run the same renderer used by the web application.'});`;
}

export async function buildWorkflows() {
  const code = await buildRendererCode();
  await mkdir(resolve(directory, "workflows"), { recursive: true });
  await writeFile(
    resolve(directory, "workflows/smoke-markdown.json"),
    JSON.stringify(rendererWorkflow(code), null, 2) + "\n",
  );
  await writeFile(
    resolve(directory, "workflows/smoke-markdown.sdk.ts"),
    rendererSdkCode(code) + "\n",
  );
  console.log(
    "Built shared Markdown verification workflow; no provider keys or credential IDs included.",
  );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await buildWorkflows();
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", resolve(directory, "src/build-production.ts")],
    {
      cwd: resolve(directory, ".."),
      stdio: "inherit",
      windowsHide: true,
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) process.exitCode = result.status ?? 1;
}
