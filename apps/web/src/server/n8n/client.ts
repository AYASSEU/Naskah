import 'server-only';
import { AppError } from '../http/errors';
import { registerSecret } from '../security/redact';

export interface CredentialRef {
  id: string;
  name: string;
}
export interface WorkflowNode {
  id: string;
  name: string;
  type: string;
  typeVersion: number;
  position: [number, number];
  parameters: Record<string, unknown>;
  credentials?: Record<string, CredentialRef>;
  [key: string]: unknown;
}
export interface Workflow {
  id?: string;
  name: string;
  nodes: WorkflowNode[];
  connections: Record<string, unknown>;
  settings: Record<string, unknown>;
  active?: boolean;
  versionId?: string;
  [key: string]: unknown;
}
export class N8nApiError extends AppError {
  constructor(public httpStatus: number) {
    super(
      httpStatus === 401 || httpStatus === 403 ? 'n8n_unauthorized' : 'n8n_unreachable',
      502,
      httpStatus >= 500,
    );
  }
}
const schemaCache = new Map<
  string,
  { expires: number; schema: { properties: Record<string, { type: string }>; required?: string[] } }
>();
const updateCapabilities = new Map<string, 'PATCH' | 'PUT' | 'recreate'>();
export class N8nClient {
  constructor(
    readonly baseUrl: string,
    private apiKey: string,
  ) {
    registerSecret(apiKey);
  }
  async request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl.replace(/\/$/, '')}/api/v1/${path}`, {
        method,
        redirect: 'error',
        headers: { 'X-N8N-API-KEY': this.apiKey, 'Content-Type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(20000),
      });
    } catch {
      throw new AppError('n8n_unreachable', 502, true);
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new N8nApiError(response.status);
    }
    if (response.status === 204) return undefined as T;
    const text = await response.text();
    return text ? (JSON.parse(text) as T) : (undefined as T);
  }
  async list<T>(resource: string) {
    const values: T[] = [];
    let cursor: string | undefined;
    do {
      const page = await this.request<{ data: T[]; nextCursor?: string }>(
        `${resource}?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`,
      );
      values.push(...page.data);
      cursor = page.nextCursor;
    } while (cursor);
    return values;
  }
  async credentialSchema(type: string) {
    const cacheKey = `${this.baseUrl}:${type}`,
      cached = schemaCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) return cached.schema;
    const schema = await this.request<{
      properties: Record<string, { type: string }>;
      required?: string[];
    }>(`credentials/schema/${encodeURIComponent(type)}`);
    schemaCache.set(cacheKey, { schema, expires: Date.now() + 3600000 });
    return schema;
  }
  async createCredential(name: string, type: string, data: Record<string, string>) {
    const schema = await this.credentialSchema(type);
    if (
      Object.keys(data).some((k) => !schema.properties[k]) ||
      schema.required?.some((k) => !(k in data))
    )
      throw new AppError('credential_schema_mismatch', 502);
    const created = await this.request<CredentialRef>('credentials', 'POST', { name, type, data });
    return { id: created.id, name: created.name };
  }
  async updateCredential(
    id: string,
    name: string,
    type: string,
    data: Record<string, string>,
  ): Promise<CredentialRef> {
    const capability = updateCapabilities.get(this.baseUrl);
    for (const method of capability === 'recreate'
      ? []
      : capability === 'PUT'
        ? ['PUT']
        : ['PATCH', 'PUT']) {
      try {
        const updated = await this.request<CredentialRef>(
          `credentials/${encodeURIComponent(id)}`,
          method,
          { name, type, data },
        );
        updateCapabilities.set(this.baseUrl, method as 'PATCH' | 'PUT');
        return { id: updated.id, name: updated.name };
      } catch (error) {
        if (!(error instanceof N8nApiError) || ![404, 405, 501].includes(error.httpStatus))
          throw error;
      }
    }
    updateCapabilities.set(this.baseUrl, 'recreate');
    // Keep the old credential until every reference has been rebound successfully.
    const replacement = await this.createCredential(name, type, data);
    try {
      await this.rebind(id, replacement);
      await this.request(`credentials/${encodeURIComponent(id)}`, 'DELETE').catch((error) => {
        if (!(error instanceof N8nApiError && error.httpStatus === 404)) throw error;
      });
      return replacement;
    } catch (error) {
      await this.rebind(replacement.id, { id, name }).catch(() => {});
      throw error;
    }
  }
  async putWorkflow(w: Workflow) {
    const body = {
      name: w.name,
      nodes: w.nodes,
      connections: w.connections,
      settings: w.settings,
      ...(w.nodeGroups ? { nodeGroups: w.nodeGroups } : {}),
    };
    return w.id
      ? this.request<Workflow>(`workflows/${w.id}`, 'PUT', body)
      : this.request<Workflow>('workflows', 'POST', body);
  }
  async activate(id: string) {
    return this.request<Workflow>(`workflows/${id}/activate`, 'POST');
  }
  async rebind(oldId: string, replacement: CredentialRef) {
    const rebound: { workflowId: string; node: string }[] = [];
    for (const listed of await this.list<Workflow>('workflows')) {
      if (!listed.id || !listed.name.startsWith('Naskah / ')) continue;
      const w = await this.request<Workflow>(`workflows/${listed.id}`);
      let changed = false;
      for (const node of w.nodes)
        for (const [type, ref] of Object.entries(node.credentials ?? {}))
          if (ref.id === oldId) {
            node.credentials![type] = replacement;
            changed = true;
            rebound.push({ workflowId: w.id!, node: node.name });
          }
      if (changed) {
        await this.putWorkflow(w);
        if (w.active) await this.activate(w.id!);
      }
    }
    return rebound;
  }
  async webhook(path: string, token: string, payload: unknown, timeout = 10000) {
    registerSecret(token);
    let response: Response | undefined;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        response = await fetch(`${this.baseUrl.replace(/\/$/, '')}/webhook/${path}`, {
          method: 'POST',
          redirect: 'error',
          headers: { 'Content-Type': 'application/json', 'X-Naskah-Token': token },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(timeout),
        });
      } catch {
        throw new AppError('n8n_unreachable', 502, true);
      }
      // Publication registration is asynchronous. A 404 has not started execution.
      if (response.status !== 404 || attempt === 3) break;
      await response.body?.cancel();
      await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
    }
    if (!response) throw new AppError('n8n_unreachable', 502, true);
    if (!response.ok) {
      await response.body?.cancel();
      throw new N8nApiError(response.status);
    }
    return { status: response.status, data: (await response.json()) as unknown };
  }
}
