import 'server-only';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  ProjectSchema,
  SectionSchema,
  DocumentSchema,
  TemplateSchema,
  RevisionProposalSchema,
  type Section,
  type SrsTemplate,
} from '@naskah/contracts';
import { parseRequirements } from '@naskah/core';
import { transaction, type Transaction } from '../db/client';
import type { Database } from '../db/types';
import { AppError } from '../http/errors';
type Tables = Database['public']['Tables'];
export type ProjectRow = Tables['projects']['Row'];
export type SectionRow = Tables['sections']['Row'];
export type RunRow = Tables['srs_generation_logs']['Row'];
export type RevisionRow = Tables['revision_proposals']['Row'];
export const iso = (value: string | Date) => new Date(value).toISOString();
export const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
export const projectDTO = (p: ProjectRow) =>
  ProjectSchema.parse({
    id: p.id,
    ownerId: p.owner_id,
    sessionId: p.session_id,
    title: p.title,
    domain: p.domain,
    version: p.version,
    status: p.status,
    rawText: p.raw_text,
    createdAt: iso(p.created_at),
    updatedAt: iso(p.updated_at),
    output_language: p.output_language,
    templateId: p.template_id,
  });
export const sectionDTO = (s: SectionRow) =>
  SectionSchema.parse({
    id: s.section_id,
    number: s.number,
    title: s.title,
    markdown: s.markdown,
    status: s.status,
    source: s.source,
    requirements: s.requirements,
    guardrail: s.guardrail,
    version: s.version,
    locked: s.locked,
    updatedAt: iso(s.updated_at),
  });
export const proposalDTO = (r: RevisionRow, sectionId: string) =>
  RevisionProposalSchema.parse({
    id: r.id,
    sectionId,
    instruction: r.instruction,
    before: r.before_text,
    after: r.after_text,
    retrievalQuery: r.refined_query,
    status: r.status,
    base_section_version: r.base_section_version,
    chunks: r.retrieved_chunks,
    guardrail: r.guardrail,
  });
export async function projectTx(tx: Transaction, owner: string, id: string, lock = false) {
  if (lock) {
    await tx`select pg_advisory_xact_lock(hashtextextended(${'naskah-project:' + id},0))`;
    await tx`select session_id from public.srs_generation_logs where project_id=${id} and owner_id=${owner} for update`;
  }
  const [p] = lock
    ? await tx<
        ProjectRow[]
      >`select * from public.projects where id=${id} and owner_id=${owner} for update`
    : await tx<ProjectRow[]>`select * from public.projects where id=${id} and owner_id=${owner}`;
  if (!p) throw new AppError('not_found', 404);
  return p;
}
export async function templateTx(tx: Transaction, id: string): Promise<SrsTemplate> {
  const [row] = await tx<
    { value: unknown }[]
  >`select value from public.app_config where key=${'template:' + id}`;
  if (!row) throw new AppError('config_missing', 503);
  const template = object(row.value);
  return TemplateSchema.parse({
    ...template,
    chapters: (template.chapters as Record<string, unknown>[]).map((ch) => ({
      ...ch,
      prompt: ch.prompt ?? '',
    })),
  });
}
export async function documentTx(tx: Transaction, owner: string, id: string) {
  const p = await projectTx(tx, owner, id);
  const [doc] = await tx<
    Tables['documents']['Row'][]
  >`select * from public.documents where project_id=${id} and owner_id=${owner}`;
  if (!doc) throw new AppError('not_found', 404);
  const rows = await tx<
    SectionRow[]
  >`select * from public.sections where project_id=${id} and owner_id=${owner}`;
  const [run] = await tx<
    RunRow[]
  >`select * from public.srs_generation_logs where project_id=${id} and owner_id=${owner}`;
  const checkpoint = z.array(SectionSchema).parse(run?.completed_sections ?? []);
  const sections = rows
    .map((row) => {
      const persisted = sectionDTO(row),
        partial = checkpoint.find((s) => s.id === row.section_id);
      return row.status === 'pending' && partial
        ? { ...partial, version: row.version, locked: row.locked }
        : persisted;
    })
    .sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
  let chunks = doc.chunks;
  if (!Array.isArray(chunks) || !chunks.length) {
    const events = await tx<
      { payload: { chunks: unknown[] } }[]
    >`select payload from public.generation_events where owner_id=${owner} and session_id=${p.session_id} and scope='generation' and type='retrieval_context' order by seq desc limit 16`;
    const unique = new Map<string, unknown>();
    for (const event of events)
      for (const chunk of event.payload.chunks ?? [])
        if (!unique.has(String(object(chunk).id))) unique.set(String(object(chunk).id), chunk);
    chunks = [...unique.values()] as typeof doc.chunks;
  }
  return DocumentSchema.parse({
    projectId: id,
    templateId: doc.template_id,
    sections,
    chunks,
    metadata: {
      title: p.title,
      domain: p.domain,
      createdAt: iso(p.created_at),
      generationSeconds: Number(run?.execution_time_seconds ?? 0),
      ...object(doc.metadata),
    },
  });
}
export async function ensurePendingTx(tx: Transaction, p: ProjectRow) {
  const template = await templateTx(tx, p.template_id);
  const metadata = {
    title: p.title,
    domain: p.domain,
    createdAt: iso(p.created_at),
    generationSeconds: 0,
  };
  await tx`insert into public.documents(project_id,owner_id,template_id,metadata) values(${p.id},${p.owner_id},${p.template_id},${JSON.stringify(metadata)}::text::jsonb) on conflict(project_id) do nothing`;
  for (const chapter of template.chapters)
    for (const s of chapter.subsections)
      await tx`insert into public.sections(owner_id,project_id,section_id,number,title) values(${p.owner_id},${p.id},${s.number},${s.number},${s.title}) on conflict(project_id,section_id) do nothing`;
}
export async function snapshotTx(tx: Transaction, owner: string, id: string, label: string) {
  const document = await documentTx(tx, owner, id);
  await tx`insert into public.document_versions(owner_id,project_id,label,sections) values(${owner},${id},${label},${JSON.stringify(document.sections)}::text::jsonb)`;
}
export function assertUniqueRequirements(sections: Section[]) {
  const ids = sections.flatMap((s) => parseRequirements(s.markdown).map((r) => r.id));
  if (new Set(ids).size !== ids.length) throw new AppError('duplicate_requirement_id', 409);
}
export async function writeSectionTx(
  tx: Transaction,
  p: ProjectRow,
  input: Section,
  expected: number,
) {
  const [row] = await tx<
    SectionRow[]
  >`select * from public.sections where owner_id=${p.owner_id} and project_id=${p.id} and section_id=${input.id} for update`;
  if (!row) throw new AppError('not_found', 404);
  if (row.version !== expected)
    throw new AppError('section_changed', 409, false, { current: sectionDTO(row) });
  if (input.number !== row.number || input.title !== row.title) throw new AppError('invalid_input');
  const value = {
    markdown: input.markdown,
    status: input.status,
    source: input.source,
    requirements: parseRequirements(input.markdown),
    guardrail: input.guardrail,
    locked: input.status === 'locked',
  };
  const [saved] = await tx<
    SectionRow[]
  >`select * from public.save_section(${p.owner_id}::uuid,${p.id}::uuid,${input.id},${expected},${JSON.stringify(value)}::text::jsonb)`;
  const dto = sectionDTO(saved!);
  const [run] = await tx<
    RunRow[]
  >`select * from public.srs_generation_logs where project_id=${p.id} and owner_id=${p.owner_id}`;
  const checkpoint = z.array(SectionSchema).parse(run?.completed_sections ?? []);
  if (checkpoint.some((s) => s.id === dto.id))
    await tx`update public.srs_generation_logs set completed_sections=${JSON.stringify(checkpoint.map((s) => (s.id === dto.id ? dto : s)))}::text::jsonb where session_id=${p.session_id} and owner_id=${p.owner_id}`;
  await tx`update public.projects set updated_at=now() where id=${p.id} and owner_id=${p.owner_id}`;
  return dto;
}
export async function assertEditableTx(tx: Transaction, p: ProjectRow) {
  const [run] = await tx<
    RunRow[]
  >`select * from public.srs_generation_logs where project_id=${p.id} and owner_id=${p.owner_id}`;
  if (run && ['queued', 'running'].includes(run.status))
    throw new AppError('generation_in_progress', 409);
}
export const getDocument = (owner: string, id: string) =>
  transaction((tx) => documentTx(tx, owner, id));
export async function createProject(
  owner: string,
  input: z.infer<typeof import('@naskah/contracts').ProjectCreateSchema>,
) {
  return transaction(async (tx) => {
    const [p] = await tx<
      ProjectRow[]
    >`insert into public.projects(id,owner_id,title,domain,version,status,raw_text,output_language,template_id) values(${randomUUID()},${owner},${input.title},${input.domain},${input.version},${input.status},${input.rawText},${input.output_language ?? 'id'},${input.templateId ?? 'ieee-830-1998'}) returning *`;
    await ensurePendingTx(tx, p!);
    return projectDTO(p!);
  });
}
