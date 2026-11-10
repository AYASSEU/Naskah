import 'server-only';
import { z } from 'zod';
import {
  ProjectSchema,
  ProjectCreateSchema,
  ProjectPatchSchema,
  DocumentSchema,
  SectionSchema,
  SectionWriteSchema,
  DocumentWriteSchema,
  VersionSchema,
  SectionVersionSchema,
  GenerationAcceptedSchema,
  RevisionAcceptedSchema,
  RevisionProposalSchema,
  OkSchema,
  GenerationLogSchema,
} from '@naskah/contracts';
import { parseRequirements } from '@naskah/core';
import { transaction, db } from '../db/client';
import { ownerRoute, readJson, json } from '../http/route';
import { AppError } from '../http/errors';
import {
  projectTx,
  projectDTO,
  sectionDTO,
  documentTx,
  createProject,
  assertEditableTx,
  assertUniqueRequirements,
  writeSectionTx,
  snapshotTx,
  proposalDTO,
  iso,
  type ProjectRow,
  type SectionRow,
  type RevisionRow,
  type RunRow,
} from './data';
import {
  startGeneration,
  resumeGeneration,
  cancelGeneration,
  startRevision,
  getRevision,
  streamEvents,
  reconcileRuns,
  stopExecution,
} from './runs';
type Resource =
  | 'projects'
  | 'project'
  | 'document'
  | 'section'
  | 'versions'
  | 'restore'
  | 'sectionVersions'
  | 'sectionRestore'
  | 'generations'
  | 'resume'
  | 'cancel'
  | 'events'
  | 'revisions'
  | 'revision'
  | 'accept'
  | 'reject'
  | 'logs';
const reply = (schema: z.ZodType, value: unknown, status = 200) =>
  json(schema.parse(value), status);
const id = (value?: string) => z.uuid().parse(value);
export function api(
  request: Request,
  resource: Resource,
  params: { id?: string; version?: string } = {},
) {
  return ownerRoute(
    request,
    async (owner) => {
      const method = request.method;
      if (resource === 'generations' && method === 'POST')
        return reply(
          GenerationAcceptedSchema,
          await startGeneration(owner, await readJson(request, z.unknown())),
          202,
        );
      if (resource === 'resume')
        return reply(GenerationAcceptedSchema, await resumeGeneration(owner, id(params.id)), 202);
      if (resource === 'cancel') {
        await cancelGeneration(owner, id(params.id));
        return reply(OkSchema, { ok: true });
      }
      if (resource === 'events') return streamEvents(request, owner, id(params.id));
      if (resource === 'revisions' && method === 'POST')
        return reply(
          RevisionAcceptedSchema,
          await startRevision(owner, await readJson(request, z.unknown())),
          202,
        );
      if (resource === 'revisions' && method === 'GET') {
        const projectId = id(new URL(request.url).searchParams.get('projectId') ?? undefined);
        await reconcileRuns(owner);
        const proposals = await transaction(async (tx) => {
          await projectTx(tx, owner, projectId);
          const rows = await tx<
            (RevisionRow & { textual_id: string })[]
          >`select r.*,s.section_id as textual_id from public.revision_proposals r join public.sections s on s.id=r.section_id and s.owner_id=r.owner_id where r.owner_id=${owner} and r.project_id=${projectId} and r.status='pending' order by r.created_at`;
          return rows.map((row) => proposalDTO(row, row.textual_id));
        });
        return reply(z.array(RevisionProposalSchema), proposals);
      }
      if (resource === 'revision')
        return reply(RevisionProposalSchema, await getRevision(owner, id(params.id)));
      if (resource === 'accept' || resource === 'reject') {
        const revisionId = id(params.id);
        const result = await transaction(async (tx) => {
          const [found] = await tx<
            RevisionRow[]
          >`select * from public.revision_proposals where id=${revisionId} and owner_id=${owner}`;
          if (!found) throw new AppError('not_found', 404);
          const p = await projectTx(tx, owner, found.project_id, true);
          const [r] = await tx<
            RevisionRow[]
          >`select * from public.revision_proposals where id=${revisionId} and owner_id=${owner} for update`;
          const [section] = await tx<
            SectionRow[]
          >`select * from public.sections where id=${r!.section_id} and owner_id=${owner}`;
          if (resource === 'reject') {
            if (r!.status === 'rejected') return { ok: true };
            if (r!.status !== 'pending') throw new AppError('revision_not_ready', 409);
            await tx`update public.revision_proposals set status='rejected',updated_at=now() where id=${revisionId} and owner_id=${owner}`;
            return { ok: true };
          }
          if (r!.status === 'accepted') return sectionDTO(section!);
          if (r!.status !== 'pending') throw new AppError('revision_not_ready', 409);
          if (section!.locked) throw new AppError('section_locked', 409);
          if (section!.version !== r!.base_section_version)
            throw new AppError('section_changed', 409, false, { current: sectionDTO(section!) });
          const document = await documentTx(tx, owner, p.id);
          const requirements = parseRequirements(r!.after_text!);
          assertUniqueRequirements(
            document.sections.map((s) =>
              s.id === section!.section_id ? { ...s, markdown: r!.after_text!, requirements } : s,
            ),
          );
          await snapshotTx(tx, owner, p.id, 'Revision accepted');
          const [saved] = await tx<
            SectionRow[]
          >`select * from public.accept_revision(${owner}::uuid,${revisionId}::uuid,${JSON.stringify(requirements)}::text::jsonb)`;
          await tx`update public.projects set updated_at=now() where id=${p.id} and owner_id=${owner}`;
          return sectionDTO(saved!);
        });
        return reply(resource === 'accept' ? SectionSchema : OkSchema, result);
      }
      if (resource === 'projects') {
        if (method === 'POST')
          return reply(
            ProjectSchema,
            await createProject(owner, await readJson(request, ProjectCreateSchema)),
            201,
          );
        await reconcileRuns(owner);
        const projects = await transaction(
          (tx) =>
            tx<
              ProjectRow[]
            >`select * from public.projects where owner_id=${owner} order by updated_at desc`,
        );
        return reply(z.array(ProjectSchema), projects.map(projectDTO));
      }
      if (resource === 'project') {
        const projectId = id(params.id);
        if (method === 'GET') {
          await reconcileRuns(owner);
          return reply(
            ProjectSchema,
            await transaction(async (tx) => projectDTO(await projectTx(tx, owner, projectId))),
          );
        }
        if (method === 'DELETE') {
          const executions = await transaction(async (tx) => {
            await projectTx(tx, owner, projectId, true);
            const rows = await tx<
              { id: string | null }[]
            >`select n8n_execution_id as id from public.srs_generation_logs where project_id=${projectId} and owner_id=${owner} and status in ('queued','running') union select n8n_execution_id as id from public.revision_proposals where project_id=${projectId} and owner_id=${owner} and status='generating'`;
            const exports = await tx<
              { object_path: string }[]
            >`select object_path from public.exports where project_id=${projectId} and owner_id=${owner}`;
            if (exports.length) {
              const removed = await db()
                .storage.from('exports')
                .remove(exports.map((row) => row.object_path));
              if (removed.error) throw new AppError('export_storage_failed', 503, true);
            }
            await tx`delete from public.projects where id=${projectId} and owner_id=${owner}`;
            return rows;
          });
          for (const execution of executions) await stopExecution(owner, execution.id);
          return reply(OkSchema, { ok: true });
        }
        const input = await readJson(request, ProjectPatchSchema);
        return reply(
          ProjectSchema,
          await transaction(async (tx) => {
            const p = await projectTx(tx, owner, projectId, true);
            await assertEditableTx(tx, p);
            if (input.rawText !== undefined && input.rawText !== p.raw_text)
              throw new AppError('invalid_input');
            if (input.templateId !== undefined && input.templateId !== p.template_id)
              throw new AppError('invalid_input');
            if (input.status === 'finalized') {
              const sections = await tx<
                SectionRow[]
              >`select * from public.sections where project_id=${projectId} and owner_id=${owner}`;
              const [open] =
                await tx`select id from public.revision_proposals where project_id=${projectId} and owner_id=${owner} and status in ('generating','pending') limit 1`;
              if (!sections.length || sections.some((s) => !s.locked || !s.markdown) || open)
                throw new AppError('revision_pending', 409);
            }
            const [updated] = await tx<
              ProjectRow[]
            >`update public.projects set title=${input.title ?? p.title},domain=${input.domain ?? p.domain},version=${input.version ?? p.version},status=${input.status ?? p.status},output_language=${input.output_language ?? p.output_language},updated_at=now() where id=${projectId} and owner_id=${owner} returning *`;
            return projectDTO(updated!);
          }),
        );
      }
      if (resource === 'document')
        return reply(
          DocumentSchema,
          await transaction((tx) => documentTx(tx, owner, id(params.id))),
        );
      if (resource === 'section') {
        const input = await readJson(request, SectionWriteSchema),
          expected = request.headers.get('if-match')?.replace(/^"|"$/g, '');
        if (
          !expected ||
          !/^\d+$/.test(expected) ||
          Number(expected) < 1 ||
          !Number.isSafeInteger(Number(expected))
        )
          throw new AppError('invalid_input', 428);
        if (params.id !== input.section.id) throw new AppError('invalid_input');
        return reply(
          SectionSchema,
          await transaction(async (tx) => {
            const p = await projectTx(tx, owner, input.projectId, true);
            await assertEditableTx(tx, p);
            const doc = await documentTx(tx, owner, p.id);
            assertUniqueRequirements(
              doc.sections.map((s) => (s.id === input.section.id ? input.section : s)),
            );
            await snapshotTx(tx, owner, p.id, 'Section edited');
            return writeSectionTx(tx, p, input.section, Number(expected));
          }),
        );
      }
      if (resource === 'versions') {
        const projectId = id(params.id);
        if (method === 'GET') {
          const versions = await transaction(async (tx) => {
            await projectTx(tx, owner, projectId);
            return tx<
              { id: string; label: string; sections: unknown; created_at: string }[]
            >`select id,label,sections,created_at from public.document_versions where project_id=${projectId} and owner_id=${owner} order by created_at desc`;
          });
          return reply(
            z.array(VersionSchema),
            versions.map((v) => ({
              id: v.id,
              projectId,
              label: v.label,
              sections: v.sections,
              createdAt: iso(v.created_at),
            })),
          );
        }
        const input = await readJson(request, DocumentWriteSchema, 8 * 1024 * 1024);
        const doc = await transaction(async (tx) => {
          const p = await projectTx(tx, owner, projectId, true);
          await assertEditableTx(tx, p);
          const before = await documentTx(tx, owner, projectId);
          if (
            input.sections.length !== before.sections.length ||
            new Set(input.sections.map((s) => s.id)).size !== before.sections.length
          )
            throw new AppError('invalid_input');
          assertUniqueRequirements(input.sections);
          await snapshotTx(tx, owner, projectId, input.label ?? 'Document saved');
          for (const next of input.sections) {
            const old = before.sections.find((s) => s.id === next.id);
            if (!old || next.version !== old.version)
              throw new AppError('section_changed', 409, false, { current: old });
            const fields = (s: typeof next) =>
              JSON.stringify([s.markdown, s.status, s.source, s.guardrail]);
            if (fields(old) !== fields(next)) await writeSectionTx(tx, p, next, next.version!);
          }
          return documentTx(tx, owner, projectId);
        });
        return reply(DocumentSchema, doc);
      }
      if (resource === 'restore') {
        const projectId = id(params.id),
          versionId = id(params.version);
        const doc = await transaction(async (tx) => {
          const p = await projectTx(tx, owner, projectId, true);
          await assertEditableTx(tx, p);
          const [version] = await tx<
            { sections: unknown }[]
          >`select sections from public.document_versions where id=${versionId} and project_id=${projectId} and owner_id=${owner}`;
          if (!version) throw new AppError('not_found', 404);
          const current = await documentTx(tx, owner, projectId),
            targets = z.array(SectionSchema).parse(version.sections);
          if (targets.length !== current.sections.length) throw new AppError('invalid_input');
          assertUniqueRequirements(targets);
          await snapshotTx(tx, owner, projectId, 'Before restore');
          for (const target of targets) {
            const old = current.sections.find((s) => s.id === target.id);
            if (!old) throw new AppError('invalid_input');
            await writeSectionTx(
              tx,
              p,
              { ...target, status: 'edited', source: 'human' },
              old.version!,
            );
          }
          return documentTx(tx, owner, projectId);
        });
        return reply(DocumentSchema, doc);
      }
      if (resource === 'sectionVersions' || resource === 'sectionRestore') {
        const projectId = id(new URL(request.url).searchParams.get('projectId') ?? undefined),
          sectionId = z.string().min(1).max(40).parse(params.id);
        const result = await transaction(async (tx) => {
          const p = await projectTx(tx, owner, projectId, resource === 'sectionRestore');
          const [s] = await tx<
            SectionRow[]
          >`select * from public.sections where project_id=${projectId} and section_id=${sectionId} and owner_id=${owner}`;
          if (!s) throw new AppError('not_found', 404);
          if (resource === 'sectionVersions') {
            const versions = await tx<
              {
                id: string;
                version: number;
                label: string;
                snapshot: SectionRow;
                created_at: string;
              }[]
            >`select * from public.section_versions where section_id=${s.id} and owner_id=${owner} order by version desc`;
            return versions.map((v) => ({
              id: v.id,
              version: v.version,
              label: v.label,
              createdAt: iso(v.created_at),
              section: sectionDTO(v.snapshot),
            }));
          }
          await assertEditableTx(tx, p);
          const versionId = id(params.version);
          const [version] = await tx<
            { snapshot: SectionRow }[]
          >`select snapshot from public.section_versions where id=${versionId} and section_id=${s.id} and owner_id=${owner}`;
          if (!version) throw new AppError('not_found', 404);
          const target = {
            ...sectionDTO(version.snapshot),
            status: 'edited' as const,
            source: 'human' as const,
          };
          const doc = await documentTx(tx, owner, p.id);
          assertUniqueRequirements(
            doc.sections.map((section) => (section.id === target.id ? target : section)),
          );
          await snapshotTx(tx, owner, p.id, 'Section restored');
          return writeSectionTx(tx, p, target, s.version);
        });
        return reply(
          resource === 'sectionVersions' ? z.array(SectionVersionSchema) : SectionSchema,
          result,
        );
      }
      if (resource === 'logs') {
        const rows = await transaction(
          (tx) =>
            tx<
              RunRow[]
            >`select * from public.srs_generation_logs where owner_id=${owner} and status in ('completed','failed','cancelled') order by created_at desc`,
        );
        return reply(
          z.array(GenerationLogSchema),
          rows.map((r) => ({
            session_id: r.session_id,
            project_title: r.project_title,
            domain: r.domain,
            status: r.status === 'completed' ? 'success' : 'failed',
            execution_time_seconds: r.execution_time_seconds,
            structure_completeness_pct: r.structure_completeness_pct,
            created_at: iso(r.created_at),
            is_thesis_run: r.is_thesis_run,
            model: r.model ?? undefined,
            embedding_model: r.embedding_model ?? undefined,
            metrics: r.metrics,
          })),
        );
      }
      throw new AppError('not_found', 404);
    },
    request.method === 'POST' && ['generations', 'resume', 'revisions'].includes(resource)
      ? resource
      : undefined,
  );
}
