import 'server-only';
import { type SystemStatus } from '@naskah/contracts';
import { db, transaction } from '../db/client';
import { integrationState, n8nClient } from './store';
import type { Workflow } from '../n8n/client';
export async function systemStatus(owner: string): Promise<SystemStatus> {
  const integrations = await Promise.all(
    (['deepseek', 'embeddings', 'n8n'] as const).map((id) => integrationState(owner, id)),
  );
  const reasons: SystemStatus['reasons'] = integrations
    .filter((i) => !i.tested)
    .map((i) => ({
      code: i.error_code || 'integration_not_ready',
      integration: i.id,
      href: `/settings#integration-${i.id}`,
    }));
  let workflows: SystemStatus['workflows'] = [];
  try {
    const client = await n8nClient(owner);
    workflows = (await client.list<Workflow>('workflows'))
      .filter((w) => w.name.startsWith('Naskah / '))
      .map((w) => ({ id: w.id!, name: w.name, active: !!w.active, version: w.versionId }));
    const { data: bindings } = await db()
      .from('n8n_bindings')
      .select('provider,credential_id')
      .eq('owner_id', owner);
    const actual = await client.list<{ id: string }>('credentials');
    for (const b of bindings ?? [])
      if (!actual.some((c) => c.id === b.credential_id))
        reasons.push({
          code: 'integration_not_ready',
          integration: b.provider,
          href: '/settings#integration-n8n',
        });
  } catch {
    reasons.push({
      code: 'n8n_unreachable',
      integration: 'n8n',
      href: '/settings#integration-n8n',
    });
  }
  for (const name of ['Naskah / Generate SRS', 'Naskah / Revise Section', 'Naskah / Error Handler'])
    if (!workflows.some((w) => w.name === name && (name.endsWith('Error Handler') || w.active)))
      reasons.push({
        code: 'integration_not_ready',
        integration: 'n8n',
        href: '/settings#integration-n8n',
      });
  const rows = await transaction(
    (tx) =>
      tx<
        { dataset_source: string; embedding_model: string; count: number }[]
      >`select dataset_source,embedding_model,count(*)::int as count from public.srs_knowledge_base where owner_id=${owner} group by dataset_source,embedding_model`,
  );
  const datasets: Record<string, number> = {};
  for (const row of rows)
    datasets[row.dataset_source] = (datasets[row.dataset_source] ?? 0) + row.count;
  const { data: last } = await db()
    .from('ingestion_runs')
    .select('finished_at')
    .eq('owner_id', owner)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!rows?.length)
    reasons.push({
      code: 'knowledge_base_empty',
      integration: 'knowledge',
      href: '/settings#knowledge-base',
    });
  const model = integrations.find((i) => i.id === 'embeddings')!.config.model;
  if (rows?.some((r) => r.embedding_model !== model))
    reasons.push({
      code: 'embedding_model_mismatch',
      integration: 'knowledge',
      href: '/settings#knowledge-base',
    });
  return {
    ready: reasons.length === 0,
    reasons,
    integrations,
    workflows,
    knowledge: {
      count: rows.reduce((sum, r) => sum + r.count, 0),
      datasets,
      model: rows[0]?.embedding_model ?? null,
      dimensions: 1536,
      devOnly: !!rows.length && rows.every((r) => r.dataset_source === 'dev_seed'),
      lastIngestion: last?.finished_at ?? null,
    },
  };
}
