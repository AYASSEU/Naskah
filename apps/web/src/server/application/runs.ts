import 'server-only';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  AcceptedSchema,
  GenerationAcceptedSchema,
  GenerationRequestSchema,
  RevisionAcceptedSchema,
  RevisionRequestSchema,
  SectionSchema,
  WorkflowEventSchema,
} from '@naskah/contracts';
import { transaction, type Transaction } from '../db/client';
import { env } from '../config/env.server';
import { AppError } from '../http/errors';
import { n8nClient } from '../integrations/store';
import { systemStatus } from '../integrations/status';
import { eventStream } from '../http/sse';
import { logSafe } from '../security/redact';
import {
  projectTx,
  templateTx,
  ensurePendingTx,
  proposalDTO,
  object,
  type RunRow,
  type RevisionRow,
  type SectionRow,
  type ProjectRow,
} from './data';

async function ready(owner: string) {
  const state = await systemStatus(owner);
  if (!state.ready)
    throw new AppError(state.reasons[0]?.code ?? 'integration_not_ready', 409, false, {
      reasons: state.reasons,
    });
}
async function eventTx(
  tx: Transaction,
  owner: string,
  session: string,
  type: string,
  payload: unknown,
  revision?: string,
) {
  await tx`insert into public.generation_events(event_id,owner_id,session_id,scope,scope_ref,type,payload) values(${randomUUID()},${owner},${session},${revision ? 'revision' : 'generation'},${revision ?? null},${type},${JSON.stringify(payload)}::text::jsonb)`;
}
async function failTx(
  tx: Transaction,
  run: RunRow,
  code: string,
  stage: string,
  revision?: RevisionRow,
) {
  if (revision)
    await tx`update public.revision_proposals set status='failed',error_code=${code},metrics=metrics||jsonb_build_object('watchdog_failed',${code === 'timeout'}),updated_at=now() where id=${revision.id} and owner_id=${run.owner_id}`;
  else {
    await tx`update public.srs_generation_logs set status='failed',error_code=${code},failure_stage=${stage},cancel_requested=cancel_requested or ${code === 'timeout'},metrics=metrics||jsonb_build_object('watchdog_failed',${code === 'timeout'}),finished_at=now(),updated_at=now() where session_id=${run.session_id} and owner_id=${run.owner_id}`;
    await tx`update public.projects set status='failed',updated_at=now() where id=${run.project_id} and owner_id=${run.owner_id}`;
  }
  await eventTx(
    tx,
    run.owner_id,
    run.session_id,
    'failed',
    {
      type: 'failed',
      stage,
      error: { code, retryable: true, userMessage: `backendErrors.${code}` },
    },
    revision?.id,
  );
}
export async function startGeneration(owner: string, raw: unknown, forceResume = false) {
  const input = GenerationRequestSchema.parse(raw);
  await reconcileRuns(owner);
  const prior = await transaction(async (tx) => {
    const [run] = await tx<
      RunRow[]
    >`select * from public.srs_generation_logs where session_id=${input.session_id} and owner_id=${owner}`;
    return run;
  });
  if (!prior || !['queued', 'running', 'completed'].includes(prior.status)) await ready(owner);
  const prepared = await transaction(async (tx) => {
    const [found] = await tx<
      ProjectRow[]
    >`select * from public.projects where session_id=${input.session_id} and owner_id=${owner}`;
    if (!found) throw new AppError('not_found', 404);
    const p = await projectTx(tx, owner, found.id, true);
    const [existing] = await tx<
      RunRow[]
    >`select * from public.srs_generation_logs where session_id=${input.session_id} and owner_id=${owner} for update`;
    if (existing && ['queued', 'running', 'completed'].includes(existing.status)) {
      if (forceResume && existing.status === 'completed') throw new AppError('run_not_active', 409);
      return { run: existing, project: p, launch: false, from: 1 };
    }
    if (p.status === 'finalized') throw new AppError('section_locked', 409);
    // Readiness is checked before reserving a run; no workflow is invoked when blocked.
    await ensurePendingTx(tx, p);
    if (
      input.raw_text !== p.raw_text ||
      input.project_title !== p.title ||
      input.domain !== p.domain
    )
      throw new AppError('invalid_input');
    const template = await templateTx(tx, p.template_id);
    const completed = z.array(SectionSchema).parse(existing?.completed_sections ?? []);
    const index = template.chapters.findIndex((ch) =>
      ch.subsections.some((sub) => !completed.some((s) => s.number === sub.number)),
    );
    const from = index < 0 ? template.chapters.length + 1 : index + 1;
    const [cursor] = await tx<
      { seq: number }[]
    >`select coalesce(max(seq),0)::float8 as seq from public.generation_events where session_id=${input.session_id} and owner_id=${owner}`;
    const metrics = { stream_after_seq: cursor!.seq, run_started_at: new Date().toISOString() };
    const runId = randomUUID();
    const [run] = await tx<
      RunRow[]
    >`insert into public.srs_generation_logs(session_id,owner_id,project_id,project_title,domain,run_id,scenario_label,is_thesis_run,metrics)
      values(${p.session_id},${owner},${p.id},${p.title},${p.domain},${runId},'local-ui',false,${JSON.stringify(metrics)}::text::jsonb)
      on conflict(session_id) do update set status='queued',run_id=excluded.run_id,current_stage='retrieving_context',n8n_execution_id=null,callback_event_id=null,cancel_requested=false,error_code=null,failure_stage=null,finished_at=null,metrics=excluded.metrics,updated_at=now() returning *`;
    await tx`update public.projects set status='generating',updated_at=now() where id=${p.id} and owner_id=${owner}`;
    await eventTx(tx, owner, p.session_id, 'stage', {
      type: 'stage',
      stage: 'retrieving_context',
      at: new Date().toISOString(),
    });
    return { run: run!, project: p, launch: true, from };
  });
  const { run, project: p } = prepared;
  let execution = run.n8n_execution_id;
  if (prepared.launch) {
    try {
      const result = await (
        await n8nClient(owner)
      ).webhook(
        'generate-srs',
        env().N8N_WEBHOOK_SECRET,
        {
          session_id: p.session_id,
          run_id: run.run_id,
          project_title: p.title,
          domain: p.domain,
          raw_text: p.raw_text,
          output_language: p.output_language,
          template_id: p.template_id,
          ...(input.options ? { options: input.options } : {}),
          ...(prepared.from > 1 || forceResume
            ? { resume: { from_part: prepared.from, completed_sections: run.completed_sections } }
            : {}),
        },
        10000,
      );
      const accepted = AcceptedSchema.parse(result.data);
      if (result.status !== 202 || accepted.session_id !== p.session_id)
        throw new Error('invalid_acknowledgment');
      execution = accepted.execution_id;
      await transaction(async (tx) => {
        await tx`update public.srs_generation_logs set n8n_execution_id=coalesce(n8n_execution_id,${execution}) where session_id=${p.session_id} and owner_id=${owner} and run_id=${run.run_id}`;
      });
    } catch {
      const active = await transaction(async (tx) => {
        const [current] = await tx<
          RunRow[]
        >`select * from public.srs_generation_logs where session_id=${p.session_id} and owner_id=${owner} for update`;
        // A lost HTTP acknowledgment must not fail a workflow that already claimed the run.
        if (current?.run_id === run.run_id && current.n8n_execution_id) return current;
        if (current?.run_id === run.run_id && current.status === 'queued')
          await failTx(tx, current, 'n8n_unreachable', 'dispatch');
      });
      if (active) execution = active.n8n_execution_id;
      else throw new AppError('n8n_unreachable', 502, true);
    }
  }
  return GenerationAcceptedSchema.parse({
    accepted: true,
    session_id: p.session_id,
    project_id: p.id,
    run_id: run.run_id,
    after_seq: Number(object(run.metrics).stream_after_seq ?? 0),
    execution_id: execution,
  });
}
export async function resumeGeneration(owner: string, session: string) {
  const p = await transaction(async (tx) => {
    const [p] = await tx<
      ProjectRow[]
    >`select * from public.projects where session_id=${session} and owner_id=${owner}`;
    if (!p) throw new AppError('not_found', 404);
    return p;
  });
  return startGeneration(
    owner,
    { session_id: session, project_title: p.title, domain: p.domain, raw_text: p.raw_text },
    true,
  );
}
export async function stopExecution(owner: string, id: string | null) {
  if (!id) return;
  try {
    await (await n8nClient(owner)).request(`executions/${encodeURIComponent(id)}/stop`, 'POST');
  } catch {
    /* The cancellation flag remains authoritative between workflow parts. */
  }
}
export async function cancelGeneration(owner: string, session: string) {
  const execution = await transaction(async (tx) => {
    const [run] = await tx<
      RunRow[]
    >`select * from public.srs_generation_logs where session_id=${session} and owner_id=${owner} for update`;
    if (!run) throw new AppError('not_found', 404);
    if (!['queued', 'running'].includes(run.status)) return null;
    await tx`update public.srs_generation_logs set status='cancelled',cancel_requested=true,error_code='cancelled',finished_at=now(),updated_at=now() where session_id=${session} and owner_id=${owner}`;
    await tx`update public.projects set status='failed',updated_at=now() where id=${run.project_id} and owner_id=${owner}`;
    await eventTx(tx, owner, session, 'cancelled', { type: 'cancelled' });
    return run.n8n_execution_id;
  });
  await stopExecution(owner, execution);
}
export async function startRevision(owner: string, raw: unknown) {
  const input = RevisionRequestSchema.parse(raw);
  await reconcileRuns(owner);
  await ready(owner);
  const reserved = await transaction(async (tx) => {
    const [run] = await tx<
      RunRow[]
    >`select * from public.srs_generation_logs where session_id=${input.session_id} and owner_id=${owner} for update`;
    if (!run) throw new AppError('not_found', 404);
    const p = await projectTx(tx, owner, run.project_id, true);
    if (run.status !== 'completed') throw new AppError('generation_in_progress', 409);
    const target = input.target_section.split(' ')[0]!;
    const [section] = await tx<
      SectionRow[]
    >`select * from public.sections where project_id=${p.id} and owner_id=${owner} and section_id=${target} for update`;
    if (!section) throw new AppError('not_found', 404);
    if (section.locked) throw new AppError('section_locked', 409);
    if (
      section.markdown !== input.current_section_text ||
      (input.base_section_version !== undefined && input.base_section_version !== section.version)
    )
      throw new AppError('section_changed', 409);
    const [cursor] = await tx<
      { seq: number }[]
    >`select coalesce(max(seq),0)::float8 as seq from public.generation_events where session_id=${input.session_id} and owner_id=${owner}`;
    const id = randomUUID();
    await tx`insert into public.revision_proposals(id,owner_id,project_id,section_id,session_id,before_text,instruction,base_section_version) values(${id},${owner},${p.id},${section.id},${p.session_id},${section.markdown},${input.user_instructions},${section.version})`;
    return { run, section, id, after: cursor!.seq };
  });
  try {
    const result = await (
      await n8nClient(owner)
    ).webhook(
      'revise-srs',
      env().N8N_WEBHOOK_SECRET,
      {
        session_id: input.session_id,
        revision_id: reserved.id,
        target_section: reserved.section.section_id,
        current_section_text: reserved.section.markdown,
        user_instructions: input.user_instructions,
        base_section_version: reserved.section.version,
      },
      10000,
    );
    const accepted = AcceptedSchema.parse(result.data);
    if (result.status !== 202 || accepted.session_id !== input.session_id)
      throw new Error('invalid_acknowledgment');
    await transaction(async (tx) => {
      await tx`update public.revision_proposals set n8n_execution_id=coalesce(n8n_execution_id,${accepted.execution_id}) where id=${reserved.id} and owner_id=${owner}`;
    });
  } catch {
    const claimed = await transaction(async (tx) => {
      const [revision] = await tx<
        RevisionRow[]
      >`select * from public.revision_proposals where id=${reserved.id} and owner_id=${owner} for update`;
      if (revision?.n8n_execution_id) return true;
      if (revision) await failTx(tx, reserved.run, 'n8n_unreachable', 'dispatch', revision);
      return false;
    });
    if (!claimed) throw new AppError('n8n_unreachable', 502, true);
  }
  return RevisionAcceptedSchema.parse({
    accepted: true,
    revision_id: reserved.id,
    session_id: input.session_id,
    after_seq: reserved.after,
  });
}
export async function getRevision(owner: string, id: string) {
  await reconcileRuns(owner);
  return transaction(async (tx) => {
    const [r] = await tx<
      RevisionRow[]
    >`select * from public.revision_proposals where id=${id} and owner_id=${owner}`;
    if (!r) throw new AppError('not_found', 404);
    if (['failed', 'cancelled'].includes(r.status))
      throw new AppError(r.error_code ?? 'unknown', 409, true);
    if (r.status === 'generating') throw new AppError('revision_not_ready', 409, true);
    const [s] = await tx<
      SectionRow[]
    >`select * from public.sections where id=${r.section_id} and owner_id=${owner}`;
    return proposalDTO(r, s!.section_id);
  });
}
export async function reconcileRuns(owner: string) {
  const cfg = env();
  return transaction(async (tx) => {
    const runs = await tx<
      RunRow[]
    >`select * from public.srs_generation_logs where owner_id=${owner} and status in ('queued','running') for update skip locked`;
    for (const run of runs) {
      const started = Date.parse(String(object(run.metrics).run_started_at ?? run.created_at));
      if (
        Date.now() - new Date(run.updated_at).getTime() > cfg.GENERATION_IDLE_TIMEOUT_MS ||
        Date.now() - started > cfg.GENERATION_MAX_TIMEOUT_MS
      )
        await failTx(tx, run, 'timeout', run.current_stage ?? 'dispatch');
    }
    await tx`update public.projects p set status='failed',updated_at=now() from public.srs_generation_logs l where p.id=l.project_id and p.owner_id=${owner} and l.owner_id=${owner} and p.status='generating' and l.status in ('failed','cancelled')`;
    const candidates = await tx<
      RevisionRow[]
    >`select * from public.revision_proposals where owner_id=${owner} and status='generating'`;
    for (const candidate of candidates) {
      const [run] = await tx<
        RunRow[]
      >`select * from public.srs_generation_logs where session_id=${candidate.session_id} and owner_id=${owner} for update skip locked`;
      if (!run) continue;
      const [revision] = await tx<
        RevisionRow[]
      >`select * from public.revision_proposals where id=${candidate.id} and owner_id=${owner} and status='generating' for update skip locked`;
      if (!revision) continue;
      const timeout =
        Date.now() - new Date(revision.updated_at).getTime() > cfg.GENERATION_IDLE_TIMEOUT_MS ||
        Date.now() - new Date(revision.created_at).getTime() > cfg.GENERATION_MAX_TIMEOUT_MS;
      if (!timeout && revision.error_code !== 'callback_failed') continue;
      await failTx(
        tx,
        run,
        revision.error_code === 'callback_failed' ? 'callback_failed' : 'timeout',
        'revision',
        revision,
      );
    }
  });
}
export async function streamEvents(request: Request, owner: string, session: string) {
  const query = new URL(request.url).searchParams,
    scope = query.get('scope') ?? 'generation',
    ref = query.get('ref');
  if (!['generation', 'revision'].includes(scope)) throw new AppError('invalid_input');
  if (scope === 'revision') z.uuid().parse(ref);
  const run = await transaction(async (tx) => {
    const [run] = await tx<
      RunRow[]
    >`select * from public.srs_generation_logs where session_id=${session} and owner_id=${owner}`;
    if (!run) throw new AppError('not_found', 404);
    if (scope === 'revision') {
      const [r] =
        await tx`select id from public.revision_proposals where id=${ref} and session_id=${session} and owner_id=${owner}`;
      if (!r) throw new AppError('not_found', 404);
    }
    return run;
  });
  const header = request.headers.get('last-event-id') ?? query.get('after') ?? '0';
  if (!/^\d+$/.test(header) || !Number.isSafeInteger(Number(header)))
    throw new AppError('invalid_input');
  const after = Math.max(
    Number(header),
    scope === 'generation' ? Number(object(run.metrics).stream_after_seq ?? 0) : 0,
  );
  return eventStream(
    request,
    after,
    async (cursor) => {
      await reconcileRuns(owner);
      return transaction(async (tx) => {
        const rows =
          scope === 'revision'
            ? await tx<
                { seq: number; type: string; payload: unknown }[]
              >`select seq::float8 as seq,type,payload from public.generation_events where owner_id=${owner} and session_id=${session} and scope='revision' and scope_ref=${ref} and seq>${cursor} order by seq limit 128`
            : await tx<
                { seq: number; type: string; payload: unknown }[]
              >`select seq::float8 as seq,type,payload from public.generation_events where owner_id=${owner} and session_id=${session} and scope='generation' and seq>${cursor} order by seq limit 128`;
        return rows.map((row) => ({ ...row, payload: WorkflowEventSchema.parse(row.payload) }));
      });
    },
    (event) =>
      ['completed', 'failed', 'cancelled', 'revision_ready', 'callback_failed'].includes(
        event.type,
      ),
  );
}
let watchdog: ReturnType<typeof setInterval> | undefined;
export function startRunWatchdog() {
  if (watchdog) return;
  watchdog = setInterval(() => {
    void reconcileRuns(env().LOCAL_OWNER_ID).catch(() =>
      logSafe('watchdog_failed', { code: 'internal_error' }),
    );
  }, 15000);
  watchdog.unref();
}
