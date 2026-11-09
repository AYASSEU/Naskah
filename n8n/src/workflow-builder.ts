import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Workflow, WorkflowNode } from '../../apps/web/src/server/n8n/client';

export interface BuildConfig {
  app: string;
  supabase: string;
}
async function bundle(contents: string) {
  const result = await build({
    stdin: { contents, resolveDir: resolve('n8n/src'), loader: 'ts', sourcefile: 'code-entry.ts' },
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    target: 'es2022',
    minify: true,
    charset: 'utf8',
    legalComments: 'none',
  });
  const code = result.outputFiles[0]!.text;
  if (/Object\.definePropert(?:y|ies)/.test(code))
    throw new Error('Unsafe export getter in hardened runner bundle');
  return `const __naskahResult={items:undefined};\n${code}\nreturn __naskahResult.items;`;
}
const codeNode = (
  id: string,
  name: string,
  jsCode: string,
  position: [number, number],
): WorkflowNode => ({
  id,
  name,
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position,
  parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode },
});
export async function productionWorkflow(
  kind: 'generation' | 'revision' | 'error',
  config: BuildConfig,
): Promise<Workflow> {
  const label =
    kind === 'generation'
      ? 'Generate SRS'
      : kind === 'revision'
        ? 'Revise Section'
        : 'Error Handler';
  const initial =
    kind === 'error'
      ? `import {initializeError} from './workflow-runtime';__naskahResult.items=[{json:initializeError($input.first().json,${JSON.stringify(config)},Date.now())}];`
      : `import {initialize} from './workflow-runtime';__naskahResult.items=[{json:initialize($input.first().json.body,${JSON.stringify(kind)},String($execution.id),${JSON.stringify(config)},Date.now())}];`;
  const nodes: WorkflowNode[] = [
    kind === 'error'
      ? {
          id: `${kind}-trigger`,
          name: 'Failed Naskah execution',
          type: 'n8n-nodes-base.errorTrigger',
          typeVersion: 1,
          position: [-900, 0],
          parameters: {},
        }
      : {
          id: `${kind}-trigger`,
          name: 'Authenticated request',
          type: 'n8n-nodes-base.webhook',
          typeVersion: 2.2,
          position: [-900, 0],
          parameters: {
            httpMethod: 'POST',
            path: kind === 'generation' ? 'generate-srs' : 'revise-srs',
            authentication: 'headerAuth',
            responseMode: 'responseNode',
            options: {},
          },
          credentials: { httpHeaderAuth: { id: '__resolve__', name: 'naskah/webhook-inbound' } },
        },
    codeNode(
      `${kind}-initialize`,
      kind === 'error' ? 'Read safe failure metadata' : 'Validate bounded payload',
      await bundle(initial),
      [-640, 0],
    ),
  ];
  const connections: Record<string, { main: { node: string; type: string; index: number }[][] }> =
    {};
  const connect = (from: string, to: string, index = 0) => {
    connections[from] ??= { main: [] };
    connections[from]!.main[index] ??= [];
    connections[from]!.main[index]!.push({ node: to, type: 'main', index: 0 });
  };
  connect(nodes[0]!.name, nodes[1]!.name);
  let previous = nodes[1]!.name;
  if (kind !== 'error') {
    nodes.push({
      id: `${kind}-accepted`,
      name: 'Return 202 or 400',
      type: 'n8n-nodes-base.respondToWebhook',
      typeVersion: 1.5,
      position: [-400, 0],
      parameters: {
        respondWith: 'json',
        responseBody: '={{ $json.acceptance }}',
        options: { responseCode: '={{ $json.responseCode }}', enableStreaming: false },
      },
    });
    nodes.push(
      codeNode(
        `${kind}-valid`,
        'Continue valid requests only',
        'return $input.first().json.valid ? $input.all() : [];',
        [-160, 0],
      ),
    );
    connect(previous, 'Return 202 or 400');
    connect('Return 202 or 400', 'Continue valid requests only');
    previous = 'Continue valid requests only';
  }
  nodes.push(
    codeNode(
      `${kind}-plan`,
      'Plan next stage',
      await bundle(
        `import {advance} from './workflow-runtime';const item=$input.first().json;__naskahResult.items=[{json:advance(item.state,item.response,Date.now())}];`,
      ),
      [100, 0],
    ),
  );
  const channels =
    kind === 'error' ? ['supabase', 'callback'] : ['supabase', 'llm', 'embedding', 'callback'];
  const routes = [...channels, 'wait', 'done'];
  nodes.push({
    id: `${kind}-route`,
    name: 'Route external operation',
    type: 'n8n-nodes-base.switch',
    typeVersion: 3.5,
    position: [360, 0],
    parameters: {
      mode: 'expression',
      numberOutputs: routes.length,
      output: `={{ ${JSON.stringify(routes)}.indexOf($json.action) }}`,
    },
  });
  connect(previous, 'Plan next stage');
  connect('Plan next stage', 'Route external operation');
  channels.forEach((channel, i) => {
    const credential =
      channel === 'supabase'
        ? 'supabase-rest'
        : channel === 'llm'
          ? 'deepseek'
          : channel === 'embedding'
            ? 'embeddings'
            : 'callback-bearer';
    const credentialType = channel === 'supabase' ? 'httpCustomAuth' : 'httpHeaderAuth';
    const name =
      channel === 'supabase'
        ? 'Supabase RPC and checkpoints'
        : channel === 'llm'
          ? 'LLM drafting repair and reflection'
          : channel === 'embedding'
            ? 'Embed retrieval query'
            : 'Authenticated application callback';
    nodes.push({
      id: `${kind}-http-${channel}`,
      name,
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4.5,
      position: [660, (i - 1.5) * 150],
      onError: 'continueRegularOutput',
      parameters: {
        method: 'POST',
        url: '={{ $json.request.url }}',
        authentication: 'genericCredentialType',
        genericAuthType: credentialType,
        sendBody: true,
        specifyBody: 'json',
        jsonBody: '={{ $json.request.body }}',
        options: {
          timeout: '={{ $json.request.timeout }}',
          redirect: { redirect: { followRedirects: false } },
          response: { response: { fullResponse: true, neverError: true, responseFormat: 'json' } },
        },
      },
      credentials: { [credentialType]: { id: '__resolve__', name: `naskah/${credential}` } },
    });
    connect('Route external operation', name, i);
    connect(name, 'Pair response with planned request');
  });
  nodes.push(
    codeNode(
      `${kind}-response`,
      'Pair response with planned request',
      "const prior=$('Plan next stage').item.json;return [{json:{state:prior.state,response:$input.first().json}}];",
      [1010, 0],
    ),
  );
  connect('Pair response with planned request', 'Plan next stage');
  nodes.push({
    id: `${kind}-wait`,
    name: 'Honor Retry-After and exponential backoff',
    type: 'n8n-nodes-base.wait',
    typeVersion: 1.1,
    position: [660, 390],
    parameters: { resume: 'timeInterval', amount: '={{ $json.delaySeconds }}', unit: 'seconds' },
  });
  connect('Route external operation', 'Honor Retry-After and exponential backoff', channels.length);
  connect('Honor Retry-After and exponential backoff', 'Plan next stage');
  nodes.push(
    codeNode(
      `${kind}-done`,
      'Finish without exposing documents',
      'return [{json:$input.first().json.result ?? {ok:false,code:"unknown"}}];',
      [660, 570],
    ),
  );
  connect('Route external operation', 'Finish without exposing documents', channels.length + 1);
  nodes.push({
    id: `${kind}-note`,
    name: 'Runtime design and privacy',
    type: 'n8n-nodes-base.stickyNote',
    typeVersion: 1,
    position: [-70, -600],
    parameters: {
      width: 1200,
      height: 220,
      color: 5,
      content: `## ${label}\nPure, tested modules plan each operation. HTTP nodes alone use credentials. Supabase stores owner-scoped events and chapter checkpoints; template data controls the chapter loop.\n\nRetries: 3 total attempts (5 for callbacks), exponential backoff and Retry-After. One JSON repair. Execution save policies are none; initial n8n execution rows may remain until pruning. Business results and failure checkpoints live in the application DB. Error Handler is referenced by the generation/revision settings.`,
    },
  });
  return {
    name: `Naskah / ${label}`,
    nodes,
    connections,
    nodeGroups: [
      {
        id: `${kind}-runtime`,
        name: 'Checkpointed workflow runtime',
        description:
          'One state item; explicit HTTP credential boundaries; bounded retries and durable progress.',
        nodeIds: nodes
          .filter(
            (n) =>
              [
                `${kind}-plan`,
                `${kind}-route`,
                `${kind}-response`,
                `${kind}-wait`,
                `${kind}-done`,
              ].includes(n.id) || n.id.startsWith(`${kind}-http-`),
          )
          .map((n) => n.id),
      },
    ],
    settings: {
      executionOrder: 'v1',
      timezone: 'Asia/Jakarta',
      executionTimeout: 900,
      saveDataSuccessExecution: 'none',
      saveDataErrorExecution: 'none',
      saveManualExecutions: false,
      availableInMCP: false,
    },
  };
}
export async function supabaseSmoke(config: BuildConfig, owner: string): Promise<Workflow> {
  const nodes: WorkflowNode[] = [
    {
      id: 'supabase-smoke-webhook',
      name: 'Authenticated Supabase smoke',
      type: 'n8n-nodes-base.webhook',
      typeVersion: 2.2,
      position: [-400, 0],
      parameters: {
        httpMethod: 'POST',
        path: 'naskah-smoke-supabase',
        authentication: 'headerAuth',
        responseMode: 'lastNode',
        options: {},
      },
      credentials: { httpHeaderAuth: { id: '__resolve__', name: 'naskah/webhook-inbound' } },
    },
  ];
  const connections: Record<string, { main: { node: string; type: string; index: number }[][] }> =
    {};
  const connect = (from: string, to: string, output = 0) => {
    connections[from] ??= { main: [] };
    connections[from]!.main[output] ??= [];
    connections[from]!.main[output]!.push({ node: to, type: 'main', index: 0 });
  };
  const groups: { id: string; name: string; nodeIds: string[] }[] = [];
  for (let attempt = 1; attempt <= 3; attempt++) {
    const httpName = `Supabase RPC attempt ${attempt}`,
      verifyName = `Check Supabase response ${attempt}`,
      routeName = `Route Supabase response ${attempt}`;
    nodes.push({
      id: `supabase-http-${attempt}`,
      name: httpName,
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4.5,
      position: [attempt * 450 - 400, 0],
      onError: 'continueRegularOutput',
      parameters: {
        method: 'POST',
        url: config.supabase.replace(/\/$/, '') + '/rest/v1/rpc/match_srs_chunks',
        authentication: 'genericCredentialType',
        genericAuthType: 'httpCustomAuth',
        sendBody: true,
        specifyBody: 'json',
        jsonBody: JSON.stringify({
          query_embedding: Array(1536).fill(0),
          match_count: 1,
          owner_filter: owner,
        }),
        options: {
          timeout: 15000,
          redirect: { redirect: { followRedirects: false } },
          response: { response: { fullResponse: true, neverError: true, responseFormat: 'json' } },
        },
      },
      credentials: { httpCustomAuth: { id: '__resolve__', name: 'naskah/supabase-rest' } },
    });
    nodes.push(
      codeNode(
        `supabase-check-${attempt}`,
        verifyName,
        await bundle(
          `import {retryDelay,record} from './workflow-domain';const response=$input.first().json;const status=Number(response.statusCode??0);const ok=status>=200&&status<300&&Array.isArray(response.body);const delay=retryDelay(record(response.headers),${attempt},Date.now());__naskahResult.items=[{json:{route:ok?0:(${attempt}<3&&(status===0||status===429||status>=500)&&delay!==null?1:2),delaySeconds:(delay??0)/1000,rows:ok?response.body.length:0}}];`,
        ),
        [attempt * 450 - 250, 0],
      ),
    );
    nodes.push({
      id: `supabase-route-${attempt}`,
      name: routeName,
      type: 'n8n-nodes-base.switch',
      typeVersion: 3.5,
      position: [attempt * 450 - 100, 0],
      parameters: { mode: 'expression', numberOutputs: 3, output: '={{ $json.route }}' },
    });
    connect(httpName, verifyName);
    connect(verifyName, routeName);
    connect(routeName, 'Supabase verified', 0);
    connect(routeName, 'Supabase unavailable', 2);
    groups.push({
      id: `supabase-attempt-${attempt}`,
      name: `Supabase attempt ${attempt}`,
      nodeIds: [`supabase-http-${attempt}`, `supabase-check-${attempt}`],
    });
    if (attempt < 3) {
      const waitName = `Wait before Supabase attempt ${attempt + 1}`;
      nodes.push({
        id: `supabase-wait-${attempt}`,
        name: waitName,
        type: 'n8n-nodes-base.wait',
        typeVersion: 1.1,
        position: [attempt * 450 - 100, 200],
        parameters: {
          resume: 'timeInterval',
          amount: '={{ $json.delaySeconds }}',
          unit: 'seconds',
        },
      });
      connect(routeName, waitName, 1);
      connect(waitName, `Supabase RPC attempt ${attempt + 1}`);
    } else connect(routeName, 'Supabase unavailable', 1);
  }
  nodes.push(
    codeNode(
      'supabase-success',
      'Supabase verified',
      "return [{json:{ok:true,provider:'supabase',detail:'Service credential can call vector retrieval RPC',rows:$input.first().json.rows}}];",
      [900, -250],
    ),
  );
  nodes.push(
    codeNode(
      'supabase-failed',
      'Supabase unavailable',
      "throw new Error('supabase_unreachable');",
      [900, 350],
    ),
  );
  nodes.push({
    id: 'supabase-note',
    name: 'Supabase smoke design',
    type: 'n8n-nodes-base.stickyNote',
    typeVersion: 1,
    position: [-400, -400],
    parameters: {
      content:
        '## Supabase credential smoke\nZero-vector RPC using the existing service credential. Three total attempts with exponential backoff and Retry-After. Returns a row count; never exposes retrieved documents or secrets.',
      width: 950,
      height: 180,
      color: 5,
    },
  });
  connect('Authenticated Supabase smoke', 'Supabase RPC attempt 1');
  return {
    name: 'Naskah / Smoke / Supabase',
    nodes,
    connections,
    nodeGroups: groups,
    settings: {
      executionOrder: 'v1',
      timezone: 'Asia/Jakarta',
      executionTimeout: 900,
      saveDataErrorExecution: 'none',
      saveDataSuccessExecution: 'none',
      saveManualExecutions: false,
      availableInMCP: false,
    },
  };
}
export function sdkFor(workflow: Workflow) {
  const serialize = (value: unknown): string => {
    if (typeof value === 'string' && value.startsWith('={{'))
      return `expr(${JSON.stringify(value.slice(1))})`;
    if (Array.isArray(value)) return '[' + value.map(serialize).join(',') + ']';
    if (value && typeof value === 'object')
      return (
        '{' +
        Object.entries(value)
          .map(([key, v]) => JSON.stringify(key) + ':' + serialize(v))
          .join(',') +
        '}'
      );
    return JSON.stringify(value) ?? 'null';
  };
  const lines: string[] = [];
  const names = new Map<string, string>();
  workflow.nodes.forEach((node, index) => {
    const variable = `n${index}`;
    names.set(node.name, variable);
    const config: Record<string, unknown> = { ...node };
    delete config.type;
    delete config.typeVersion;
    delete config.id;
    const credentials = node.credentials;
    delete config.credentials;
    let text = serialize(config);
    if (credentials) {
      text =
        text.slice(0, -1) +
        ',"credentials":{' +
        Object.entries(credentials)
          .map(
            ([type, ref]) => `${JSON.stringify(type)}:newCredential(${JSON.stringify(ref.name)})`,
          )
          .join(',') +
        '}}';
    }
    const constructor =
      node.type.endsWith('.webhook') || node.type.endsWith('.errorTrigger') ? 'trigger' : 'node';
    lines.push(
      `const ${variable}=${constructor}({type:${JSON.stringify(node.type)},version:${node.typeVersion},config:${text}});`,
    );
  });
  lines.push(
    `const graph=workflow(${JSON.stringify(workflow.name.toLowerCase().replaceAll(' ', '-'))},${JSON.stringify(workflow.name)});`,
  );
  for (const [from, connection] of Object.entries(workflow.connections)) {
    const outputs = (connection as { main: { node: string }[][] }).main;
    const source = names.get(from)!;
    outputs.forEach((edges, index) => {
      for (const edge of edges)
        lines.push(
          outputs.length > 1
            ? `graph.add(${source}.output(${index}).to(${names.get(edge.node)}));`
            : `graph.add(${source}).to(${names.get(edge.node)});`,
        );
    });
  }
  for (const sticky of workflow.nodes.filter((n) => n.type === 'n8n-nodes-base.stickyNote'))
    lines.push(`graph.add(${names.get(sticky.name)});`);
  for (const group of (workflow.nodeGroups ?? []) as {
    name: string;
    description: string;
    nodeIds: string[];
  }[])
    lines.push(
      `graph.group(${JSON.stringify(group.name)},[${group.nodeIds.map((id) => names.get(workflow.nodes.find((n) => n.id === id)!.name)).join(',')}],{description:${JSON.stringify(group.description)}});`,
    );
  lines.push('export default graph;');
  return lines.join('\n');
}
export async function buildProduction(
  config: BuildConfig = { app: '__NASKAH_APP_URL__', supabase: '__NASKAH_SUPABASE_URL__' },
) {
  await mkdir('n8n/workflows', { recursive: true });
  for (const kind of ['error', 'generation', 'revision'] as const) {
    const workflow = await productionWorkflow(kind, config);
    await writeFile(`n8n/workflows/${kind}.json`, JSON.stringify(workflow, null, 2) + '\n');
    await writeFile(`n8n/workflows/${kind}.sdk.ts`, sdkFor(workflow) + '\n');
  }
  const smoke = await supabaseSmoke(config, '__NASKAH_OWNER__');
  await writeFile('n8n/workflows/supabase.json', JSON.stringify(smoke, null, 2) + '\n');
  await writeFile('n8n/workflows/supabase.sdk.ts', sdkFor(smoke) + '\n');
}
