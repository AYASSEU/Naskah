import 'server-only';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import {
  FailureCallbackSchema,
  WorkflowReadyCallbackSchema,
  WorkflowRevisionCallbackSchema,
  TemplateSchema,
  type Section,
  type SrsTemplate,
} from '@naskah/contracts';
import { checkStructure, renderDocumentSections, parseRequirements } from '@naskah/core';
import { transaction } from '../db/client';
import { assertFresh, requireCallback } from '../security/auth';
import { AppError, errorResponse } from '../http/errors';
import { json, readJson } from '../http/route';
import { sectionDTO, type SectionRow } from '../application/data';

const failedSchema = FailureCallbackSchema.extend({ execution_id: z.string().min(1).max(100) });
const schemas = {
  ready: WorkflowReadyCallbackSchema,
  revision: WorkflowRevisionCallbackSchema,
  failed: failedSchema,
};
type Kind = keyof typeof schemas;
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, v]) => `${JSON.stringify(key)}:${canonical(v)}`)
      .join(',')}}`;
  return JSON.stringify(value) ?? 'null';
}
interface Run {
  session_id: string;
  run_id: string;
  owner_id: string;
  project_id: string;
  project_title: string;
  domain: string;
  status: string;
  n8n_execution_id: string | null;
  callback_event_id: string | null;
  is_thesis_run: boolean;
  created_at: Date;
  completed_sections: Section[];
  metrics: Record<string, unknown>;
}
interface Revision {
  id: string;
  section_id: string;
  owner_id: string;
  project_id: string;
  session_id: string;
  status: string;
  n8n_execution_id: string | null;
  callback_event_id: string | null;
  base_section_version: number;
  before_text: string;
  instruction: string;
}
export async function callbackRoute(request: Request, kind: Kind): Promise<Response> {
  // Bind pre-serialized JSON as text before casting to jsonb: postgres.js would
  // otherwise apply its JSONB serializer again and persist a JSON string.
  try {
    requireCallback(request);
    const body = (await readJson(request, schemas[kind] as z.ZodType, 8 * 1024 * 1024)) as
      | z.infer<typeof WorkflowReadyCallbackSchema>
      | z.infer<typeof WorkflowRevisionCallbackSchema>
      | z.infer<typeof failedSchema>;
    assertFresh(body.sent_at);
    const hash = createHash('sha256').update(canonical(body)).digest('hex');
    const result = await transaction(async (tx) => {
      const [run] = await tx<
        Run[]
      >`select * from public.srs_generation_logs where session_id=${body.session_id} for update`;
      if (!run) throw new AppError('not_found', 404);
      if (!body.run_id || run.run_id !== body.run_id) throw new AppError('run_not_active', 409);
      const [receipt] = await tx<
        { kind: string; payload_hash: string }[]
      >`select kind,payload_hash from public.callback_receipts where event_id=${body.event_id}`;
      if (receipt) {
        if (receipt.kind !== kind || receipt.payload_hash !== hash)
          throw new AppError('callback_conflict', 409);
        return { ok: true, duplicate: true };
      }
      const revisionId = 'revision_id' in body ? body.revision_id : undefined;
      const [revision] = revisionId
        ? await tx<
            Revision[]
          >`select * from public.revision_proposals where id=${revisionId} and session_id=${run.session_id} and owner_id=${run.owner_id} for update`
        : [];
      if (revisionId && !revision) throw new AppError('not_found', 404);
      if ((revision ? revision.n8n_execution_id : run.n8n_execution_id) !== body.execution_id)
        throw new AppError('run_not_active', 409);
      if ((revision?.callback_event_id ?? run.callback_event_id) !== body.event_id)
        throw new AppError('callback_conflict', 409);
      let event: Record<string, unknown>;
      let scope = 'generation';
      let scopeRef: string | null = null;
      if (kind === 'ready') {
        const payload = body as z.infer<typeof WorkflowReadyCallbackSchema>;
        if (run.status !== 'running' || revision) throw new AppError('run_not_active', 409);
        if (payload.document.projectId !== run.project_id) throw new AppError('invalid_input');
        const [project] = await tx<
          { template_id: string }[]
        >`select template_id from public.projects where id=${run.project_id} and owner_id=${run.owner_id}`;
        const [cfg] = await tx<
          { value: SrsTemplate }[]
        >`select value from public.app_config where key=${'template:' + project!.template_id}`;
        if (!cfg || payload.document.templateId !== project!.template_id)
          throw new AppError('config_missing', 503);
        const template = TemplateSchema.parse({
          ...cfg.value,
          chapters: cfg.value.chapters.map((ch) => ({ ...ch, prompt: ch.prompt ?? '' })),
        });
        const sections = payload.document.sections;
        if (
          new Set(sections.map((s) => s.number)).size !== sections.length ||
          sections.some((s) => s.id !== s.number)
        )
          throw new AppError('invalid_input');
        if (renderDocumentSections(sections, template) !== payload.markdown)
          throw new AppError('invalid_input');
        if (run.is_thesis_run && payload.document.chunks.some((c) => c.dataset === 'dev_seed'))
          throw new AppError('dev_seed_excluded');
        for (const section of sections) {
          const [old] = await tx<
            SectionRow[]
          >`select * from public.sections where project_id=${run.project_id} and section_id=${section.id} and owner_id=${run.owner_id} for update`;
          if (old?.locked && old.markdown !== section.markdown)
            throw new AppError('section_locked', 409);
          if (
            old &&
            (old.version !== (section.version ?? 1) ||
              (old.source === 'human' && old.markdown !== section.markdown))
          )
            throw new AppError('section_changed', 409);
          if (old && (old.source === 'human' || old.locked)) {
            Object.assign(section, sectionDTO(old));
            continue;
          }
          const [saved] = await tx<
            SectionRow[]
          >`insert into public.sections(owner_id,project_id,section_id,number,title,markdown,status,source,requirements,guardrail,updated_at)
            values(${run.owner_id},${run.project_id},${section.id},${section.number},${section.title},${section.markdown},'drafted','ai',${JSON.stringify(section.requirements)}::text::jsonb,${JSON.stringify(section.guardrail)}::text::jsonb,${section.updatedAt})
            on conflict(project_id,section_id) do update set markdown=excluded.markdown,title=excluded.title,status='drafted',source='ai',requirements=excluded.requirements,guardrail=excluded.guardrail,version=public.sections.version+1,updated_at=now() returning *`;
          Object.assign(section, sectionDTO(saved!));
          await tx`insert into public.guardrail_reports(owner_id,session_id,section_id,dimensions,rewrites)
            values(${run.owner_id},${run.session_id},${saved!.id},${JSON.stringify(section.guardrail.dimensions)}::text::jsonb,${JSON.stringify(section.guardrail.rewrites)}::text::jsonb)`;
        }
        const completeness = checkStructure(payload.markdown, template);
        const metrics: Record<string, unknown> = {
          ...run.metrics,
          ...payload.metrics,
          markdown_sha256: createHash('sha256').update(payload.markdown).digest('hex'),
          missing_headings: completeness.missing,
        };
        await tx`insert into public.documents(project_id,owner_id,template_id,metadata,chunks) values(${run.project_id},${run.owner_id},${payload.document.templateId},${JSON.stringify(payload.document.metadata)}::text::jsonb,${JSON.stringify(payload.document.chunks)}::text::jsonb)
          on conflict(project_id) do update set metadata=excluded.metadata,chunks=excluded.chunks`;
        await tx`update public.srs_generation_logs set status='completed',finished_at=now(),updated_at=now(),current_stage='ready',
          completed_sections=${JSON.stringify(sections)}::text::jsonb,metrics=${JSON.stringify(metrics)}::text::jsonb,
          model=${String(metrics.model ?? '')},embedding_model=${String(metrics.embedding_model ?? '')},tokens_in=${Number(metrics.tokens_in ?? 0)},tokens_out=${Number(metrics.tokens_out ?? 0)},
          guardrail_rewrite_count=${Number(metrics.rewrite_count ?? 0)},execution_time_seconds=${payload.document.metadata.generationSeconds},structure_completeness_pct=${completeness.percentage}
          where session_id=${run.session_id}`;
        await tx`update public.projects set status='in_review',updated_at=now() where id=${run.project_id} and owner_id=${run.owner_id}`;
        event = {
          type: 'completed',
          document: payload.document,
          log: {
            session_id: run.session_id,
            project_title: run.project_title,
            domain: run.domain,
            status: 'success',
            execution_time_seconds: payload.document.metadata.generationSeconds,
            structure_completeness_pct: completeness.percentage,
            created_at: run.created_at.toISOString(),
            is_thesis_run: run.is_thesis_run,
            metrics,
          },
        };
      } else if (kind === 'revision') {
        const payload = body as z.infer<typeof WorkflowRevisionCallbackSchema>;
        if (
          !revision ||
          revision.status !== 'generating' ||
          payload.base_section_version !== revision.base_section_version
        )
          throw new AppError('revision_not_ready', 409);
        const [section] = await tx<
          { version: number; locked: boolean; section_id: string }[]
        >`select version,locked,section_id from public.sections where id=${revision.section_id} and owner_id=${run.owner_id} for update`;
        if (section?.locked) throw new AppError('section_locked', 409);
        if (section?.version !== revision.base_section_version)
          throw new AppError('section_changed', 409);
        const beforeIds = parseRequirements(revision.before_text).map((r) => r.id),
          afterIds = parseRequirements(payload.after).map((r) => r.id);
        if (
          beforeIds.some((id) => !afterIds.includes(id)) ||
          new Set(afterIds).size !== afterIds.length
        )
          throw new AppError('invalid_input');
        await tx`update public.revision_proposals set after_text=${payload.after},refined_query=${payload.retrievalQuery},retrieved_chunks=${JSON.stringify(payload.chunks)}::text::jsonb,
          guardrail=${JSON.stringify(payload.guardrail)}::text::jsonb,metrics=${JSON.stringify(payload.metrics)}::text::jsonb,status='pending',updated_at=now() where id=${revision.id}`;
        scope = 'revision';
        scopeRef = revision.id;
        event = {
          type: 'revision_ready',
          revision: {
            id: revision.id,
            sectionId: section.section_id,
            instruction: revision.instruction,
            before: revision.before_text,
            after: payload.after,
            retrievalQuery: payload.retrievalQuery,
            status: 'pending',
            base_section_version: revision.base_section_version,
            chunks: payload.chunks,
            guardrail: payload.guardrail,
          },
        };
      } else {
        const payload = body as z.infer<typeof failedSchema>;
        if (
          (run.status === 'completed' ||
            (run.status === 'cancelled' && payload.code !== 'cancelled')) &&
          !revision
        )
          return { ok: true, ignored: true };
        if (run.status === 'failed' && run.metrics?.watchdog_failed && !revision)
          return { ok: true, ignored: true };
        const status = payload.code === 'cancelled' ? 'cancelled' : 'failed';
        if (revision) {
          if (['accepted', 'rejected', 'pending'].includes(revision.status))
            return { ok: true, ignored: true };
          await tx`update public.revision_proposals set status=${status},error_code=${payload.code},updated_at=now() where id=${revision.id}`;
          scope = 'revision';
          scopeRef = revision.id;
        } else {
          await tx`update public.srs_generation_logs set status=${status},error_code=${payload.code},failure_stage=${payload.stage},finished_at=coalesce(finished_at,now()),updated_at=now() where session_id=${run.session_id}`;
          await tx`update public.projects set status='failed',updated_at=now() where id=${run.project_id} and owner_id=${run.owner_id}`;
        }
        event = {
          type: status === 'cancelled' ? 'cancelled' : 'failed',
          stage: payload.stage,
          error: {
            code: payload.code,
            retryable: payload.retryable,
            userMessage: `backendErrors.${payload.code}`,
          },
        };
      }
      await tx`insert into public.callback_receipts(event_id,owner_id,session_id,kind,payload_hash) values(${body.event_id},${run.owner_id},${run.session_id},${kind},${hash})`;
      await tx`insert into public.generation_events(event_id,owner_id,session_id,scope,scope_ref,type,payload) values(${body.event_id},${run.owner_id},${run.session_id},${scope},${scopeRef},${String(event.type)},${JSON.stringify(event)}::text::jsonb) on conflict(event_id) do nothing`;
      return { ok: true, duplicate: false };
    });
    return json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
