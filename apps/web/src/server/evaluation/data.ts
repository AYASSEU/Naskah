import 'server-only';
import { randomUUID, randomInt, createHmac } from 'node:crypto';
import { z } from 'zod';
import {
  EvaluationCaseSchema,
  BlindDocumentSchema,
  ExpertReviewSchema,
  SusResponseSchema,
  EvaluationOverviewSchema,
  type EvaluationScope,
  type EvaluationCaseInputSchema,
  type EvaluationReviewInputSchema,
  type EvaluationSusInputSchema,
} from '@naskah/contracts';
import { scoreSus, renderDocumentSections } from '@naskah/core';
import { statistics } from '@/entities/evaluation/sus';
import { fixtureProjects, makeDocument } from '@/services/mock/fixtures';
import { humanBaseline } from '@/services/mock/fixtures/baseline';
import { env } from '../config/env.server';
import { transaction, type Transaction } from '../db/client';
import { projectTx, documentTx, templateTx, createProject, iso } from '../application/data';
import { AppError } from '../http/errors';
import { participantTx } from './participants';
type CaseRow = {
  id: string;
  owner_id: string;
  project_id: string;
  title: string;
  system_markdown: string;
  human_markdown: string;
  language: 'id' | 'en';
  reference_language: 'id' | 'en';
  study_design: 'paired' | 'independent';
  provenance: Record<string, unknown>;
  is_thesis_run: boolean;
  created_at: string;
};
type Assignment = {
  id: string;
  case_id: string;
  project_id: string;
  label: 'A' | 'B';
  markdown: string;
  submitted: boolean;
};
export type ReviewRow = {
  id: string;
  participant_id: string;
  assignment_id: string;
  case_id: string;
  project_id: string;
  reviewer: string;
  label: 'A' | 'B';
  ratings: number[];
  justifications: string[];
  comments: string;
  source: 'system' | 'human';
  study_design: 'paired' | 'independent';
  created_at: string;
  is_thesis_run: boolean;
};
export type SusRow = {
  id: string;
  participant_id: string;
  project_id: string | null;
  answers: number[];
  score: number;
  comment: string;
  created_at: string;
  is_thesis_run: boolean;
};
export const caseDTO = (r: CaseRow) =>
  EvaluationCaseSchema.parse({
    id: r.id,
    projectId: r.project_id,
    title: r.title,
    language: r.language,
    referenceLanguage: r.reference_language,
    design: r.study_design,
    is_thesis_run: r.is_thesis_run,
    createdAt: iso(r.created_at),
  });
export const reviewDTO = (r: ReviewRow) =>
  ExpertReviewSchema.parse({
    id: r.id,
    reviewer: r.reviewer,
    label: r.label,
    ratings: r.ratings,
    justifications: r.justifications,
    comments: r.comments,
    createdAt: iso(r.created_at),
  });
export const susDTO = (r: SusRow) =>
  SusResponseSchema.parse({
    id: r.id,
    answers: r.answers,
    score: Number(r.score),
    comment: r.comment,
    createdAt: iso(r.created_at),
  });
export const anon = (owner: string, scope: EvaluationScope, kind: string, id: string) =>
  createHmac('sha256', Buffer.from(env().APP_ENCRYPTION_KEY, 'base64'))
    .update(`evaluation-export:${owner}:${scope}:${kind}:${id}`)
    .digest('hex')
    .slice(0, 24);
export async function eligibleTx(tx: Transaction, owner: string, projectId: string) {
  const p = await projectTx(tx, owner, projectId);
  const [run] = await tx<
    { is_thesis_run: boolean; status: string; metrics: Record<string, unknown> }[]
  >`select is_thesis_run,status,metrics from public.srs_generation_logs where owner_id=${owner} and project_id=${projectId}`;
  const [dev] =
    await tx`select 1 from public.retrieved_chunk_log l join public.srs_knowledge_base k on k.id=l.chunk_id where l.owner_id=${owner} and l.session_id=${p.session_id} and (k.dataset_source='dev_seed' or k.metadata->>'dev_seed'='true') limit 1`;
  if (
    !run?.is_thesis_run ||
    run.status !== 'completed' ||
    dev ||
    JSON.stringify(run.metrics).includes('mock')
  )
    throw new AppError('dev_seed_excluded', 409);
  return p;
}
export function bounded<T>(rows: T[], limit: number): T[] {
  if (rows.length > limit) throw new AppError('evaluation_too_large', 413);
  return rows;
}
export const cases = (owner: string, scope: EvaluationScope) =>
  transaction(async (tx) =>
    bounded(
      await tx<
        CaseRow[]
      >`select * from public.evaluation_cases where owner_id=${owner} and is_thesis_run=${scope === 'research'} order by created_at desc limit 201`,
      200,
    ).map(caseDTO),
  );
export async function caseTx(tx: Transaction, owner: string, scope: EvaluationScope, id: string) {
  const [row] = await tx<
    CaseRow[]
  >`select * from public.evaluation_cases where id=${id} and owner_id=${owner} and is_thesis_run=${scope === 'research'}`;
  if (!row) throw new AppError('not_found', 404);
  return row;
}
export const createCase = (
  owner: string,
  scope: EvaluationScope,
  input: z.infer<typeof EvaluationCaseInputSchema>,
) =>
  transaction(async (tx) => {
    const project =
      scope === 'research'
        ? await eligibleTx(tx, owner, input.projectId)
        : await projectTx(tx, owner, input.projectId, true);
    if (!['in_review', 'finalized'].includes(project.status))
      throw new AppError('evaluation_case_not_ready', 409);
    if (scope === 'research' && project.output_language !== input.referenceLanguage)
      throw new AppError('language_mismatch', 422);
    const document = await documentTx(tx, owner, project.id),
      template = await templateTx(tx, document.templateId);
    if (!document.sections.some((section) => section.markdown.trim()))
      throw new AppError('evaluation_case_not_ready', 409);
    const markdown = renderDocumentSections(document.sections, template);
    if (markdown.length > 100000) throw new AppError('evaluation_too_large', 413);
    const [row] = await tx<
      CaseRow[]
    >`insert into public.evaluation_cases(owner_id,project_id,title,system_markdown,human_markdown,language,reference_language,study_design,provenance,is_thesis_run) values(${owner},${project.id},${input.title},${markdown},${input.baselineMarkdown},${project.output_language},${input.referenceLanguage},${input.design},${JSON.stringify({ note: input.provenanceNote, origin: 'owned_project_snapshot', section_versions: document.sections.map((s) => ({ number: s.number, version: s.version })) })}::text::jsonb,${scope === 'research'}) returning *`;
    return caseDTO(row!);
  });
export async function seedDev(owner: string, design: 'paired' | 'independent' = 'paired') {
  const existing = await transaction(
    (tx) =>
      tx<
        CaseRow[]
      >`select * from public.evaluation_cases where owner_id=${owner} and provenance->>'origin'='b8_synthetic_fixture' and study_design=${design} and not is_thesis_run limit 1`,
  );
  if (existing[0]) return caseDTO(existing[0]);
  const project = await createProject(owner, {
    title: 'B8 synthetic evaluation',
    domain: 'Healthcare',
    version: '1.0',
    rawText: 'Synthetic development evaluation fixture.',
    status: 'in_review',
  });
  return transaction(async (tx) => {
    const fixture = makeDocument(fixtureProjects[0]!);
    const markdown = fixture.sections.find((s) => s.number === '3.2')!.markdown;
    const [row] = await tx<
      CaseRow[]
    >`insert into public.evaluation_cases(owner_id,project_id,title,system_markdown,human_markdown,language,reference_language,study_design,provenance,is_thesis_run) values(${owner},${project.id},'Kasus uji rumah sakit',${markdown},${humanBaseline},'id','id',${design},'{"origin":"b8_synthetic_fixture","dev_seed":true}'::jsonb,false) returning *`;
    return caseDTO(row!);
  });
}
export async function blindDocuments(
  request: Request,
  owner: string,
  scope: EvaluationScope,
  caseId: string,
) {
  return transaction(async (tx) => {
    const person = await participantTx(tx, request, owner, scope);
    if (person!.role !== 'expert') throw new AppError('expert_role_required', 403);
    const c = await caseTx(tx, owner, scope, caseId);
    if (c.study_design === 'independent')
      await tx`select pg_advisory_xact_lock(hashtextextended(${'blind-independent:' + person!.id},0))`;
    await tx`select pg_advisory_xact_lock(hashtextextended(${'blind:' + person!.id + ':' + caseId},0))`;
    const existing = await tx<
      Assignment[]
    >`select id from public.blind_assignments where participant_id=${person!.id} and case_id=${caseId} and owner_id=${owner}`;
    if (!existing.length) {
      let sources: ('system' | 'human')[] = randomInt(2)
        ? ['system', 'human']
        : ['human', 'system'];
      if (c.study_design === 'independent') {
        const [old] = await tx<
          { source: 'system' | 'human' }[]
        >`select m.source from public.blind_assignments a join public.blind_source_maps m on m.assignment_id=a.id join public.evaluation_cases c on c.id=a.case_id where a.owner_id=${owner} and a.participant_id=${person!.id} and c.study_design='independent' limit 1`;
        sources = [old?.source ?? sources[0]!];
      }
      for (const [index, source] of sources.entries()) {
        const id = randomUUID();
        await tx`insert into public.blind_assignments(id,owner_id,participant_id,project_id,label,source,markdown,is_thesis_run,case_id) values(${id},${owner},${person!.id},${c.project_id},${index ? 'B' : 'A'},'blinded',${source === 'system' ? c.system_markdown : c.human_markdown},${scope === 'research'},${caseId})`;
        await tx`insert into public.blind_source_maps(assignment_id,owner_id,source) values(${id},${owner},${source})`;
      }
    }
    const rows = await tx<
      Assignment[]
    >`select a.id,a.case_id,a.label,a.markdown,exists(select 1 from public.expert_reviews r where r.assignment_id=a.id) as submitted from public.blind_assignments a where a.owner_id=${owner} and a.participant_id=${person!.id} and a.case_id=${caseId} order by a.label`;
    return rows.map((r) =>
      BlindDocumentSchema.parse({
        id: r.id,
        caseId: r.case_id,
        label: r.label,
        markdown: r.markdown,
        submitted: r.submitted,
      }),
    );
  });
}
export const mapping = (request: Request, owner: string, scope: EvaluationScope, caseId: string) =>
  transaction(async (tx) => {
    const person = await participantTx(tx, request, owner, scope);
    const c = await caseTx(tx, owner, scope, caseId);
    const rows = await tx<
      { label: string; source: string; submitted: boolean }[]
    >`select a.label,m.source,exists(select 1 from public.expert_reviews r where r.assignment_id=a.id) as submitted from public.blind_assignments a join public.blind_source_maps m on m.assignment_id=a.id and m.owner_id=a.owner_id where a.owner_id=${owner} and a.participant_id=${person!.id} and a.case_id=${caseId}`;
    if (rows.length !== (c.study_design === 'paired' ? 2 : 1) || rows.some((r) => !r.submitted))
      throw new AppError('blind_review_incomplete', 403);
    return Object.fromEntries(
      rows.map((r) => [
        r.label,
        r.source === 'system'
          ? scope === 'dev'
            ? 'system_simulated'
            : 'system_generated'
          : scope === 'dev'
            ? 'human_synthetic_sample'
            : 'human_baseline',
      ]),
    );
  });
export const saveReview = (
  request: Request,
  owner: string,
  scope: EvaluationScope,
  input: z.infer<typeof EvaluationReviewInputSchema>,
) =>
  transaction(async (tx) => {
    const person = await participantTx(tx, request, owner, scope);
    if (person!.role !== 'expert') throw new AppError('expert_role_required', 403);
    const [a] = await tx<
      Assignment[]
    >`select * from public.blind_assignments where id=${input.assignmentId} and owner_id=${owner} and participant_id=${person!.id} and is_thesis_run=${scope === 'research'} for update`;
    if (!a) throw new AppError('not_found', 404);
    const [old] = await tx<
      ReviewRow[]
    >`select * from public.expert_reviews where assignment_id=${a.id} and owner_id=${owner}`;
    if (old) {
      if (
        JSON.stringify(old.ratings) !== JSON.stringify(input.ratings) ||
        JSON.stringify(old.justifications) !== JSON.stringify(input.justifications) ||
        old.comments !== input.comments
      )
        throw new AppError('evaluation_immutable', 409);
      return reviewDTO(old);
    }
    const [row] = await tx<
      ReviewRow[]
    >`insert into public.expert_reviews(owner_id,participant_id,assignment_id,reviewer,label,ratings,justifications,comments,is_thesis_run) values(${owner},${person!.id},${a.id},${person!.code},${a.label},${JSON.stringify(input.ratings)}::text::jsonb,${JSON.stringify(input.justifications)}::text::jsonb,${input.comments},${scope === 'research'}) returning *`;
    return reviewDTO(row!);
  });
export const saveSus = (
  request: Request,
  owner: string,
  scope: EvaluationScope,
  input: z.infer<typeof EvaluationSusInputSchema>,
) =>
  transaction(async (tx) => {
    const person = await participantTx(tx, request, owner, scope);
    if (scope === 'research') {
      if (!input.projectId) throw new AppError('dev_seed_excluded', 409);
      await eligibleTx(tx, owner, input.projectId);
    } else if (input.projectId) await projectTx(tx, owner, input.projectId);
    await tx`select pg_advisory_xact_lock(hashtextextended(${'sus:' + person!.id},0))`;
    const [old] = await tx<
      SusRow[]
    >`select * from public.sus_responses where participant_id=${person!.id} and owner_id=${owner} `;
    if (old) {
      if (
        old.project_id !== (input.projectId ?? null) ||
        JSON.stringify(old.answers) !== JSON.stringify(input.answers) ||
        old.comment !== input.comment
      )
        throw new AppError('evaluation_immutable', 409);
      return susDTO(old);
    }
    const [row] = await tx<
      SusRow[]
    >`insert into public.sus_responses(owner_id,participant_id,project_id,answers,score,comment,is_thesis_run) values(${owner},${person!.id},${input.projectId ?? null},${JSON.stringify(input.answers)}::text::jsonb,${scoreSus(input.answers)},${input.comment},${scope === 'research'}) returning *`;
    return susDTO(row!);
  });
export async function completedReviews(tx: Transaction, owner: string, scope: EvaluationScope) {
  const rows = await tx<
    ReviewRow[]
  >`select r.*,a.case_id,a.project_id,m.source,c.study_design from public.expert_reviews r join public.blind_assignments a on a.id=r.assignment_id and a.owner_id=r.owner_id join public.blind_source_maps m on m.assignment_id=a.id and m.owner_id=a.owner_id join public.evaluation_cases c on c.id=a.case_id and c.owner_id=a.owner_id where r.owner_id=${owner} and r.is_thesis_run=${scope === 'research'} and (select count(*) from public.expert_reviews rr join public.blind_assignments aa on aa.id=rr.assignment_id where aa.participant_id=r.participant_id and aa.case_id=a.case_id and rr.owner_id=${owner})=case c.study_design when 'paired' then 2 else 1 end order by r.created_at limit 2001`;
  return bounded(rows, 2000);
}
export async function statsInput(
  owner: string,
  scope: EvaluationScope,
  design: 'paired' | 'independent' = 'paired',
) {
  return transaction(async (tx) => ({
    data_scope: scope,
    reviews: (await completedReviews(tx, owner, scope))
      .filter((r) => r.study_design === design)
      .map((r) => ({
        participant: anon(owner, scope, 'participant', r.participant_id),
        case_id: anon(owner, scope, 'case', r.case_id),
        source: r.source,
        ratings: r.ratings,
        is_thesis_run: r.is_thesis_run,
      })),
  }));
}
export const susRows = (owner: string, scope: EvaluationScope) =>
  transaction(async (tx) =>
    bounded(
      await tx<
        SusRow[]
      >`select * from public.sus_responses where owner_id=${owner} and is_thesis_run=${scope === 'research'} order by created_at desc limit 5001`,
      5000,
    ),
  );
export async function overview(
  owner: string,
  scope: EvaluationScope,
  design: 'paired' | 'independent' = 'paired',
) {
  return transaction(async (tx) => {
    const logs = await tx<
      { execution_time_seconds: number; structure_completeness_pct: number }[]
    >`select execution_time_seconds,structure_completeness_pct from public.srs_generation_logs where owner_id=${owner} and is_thesis_run=${scope === 'research'} limit 5001`;
    const reviews = (await completedReviews(tx, owner, scope)).filter(
        (r) => r.study_design === design,
      ),
      sus = await tx<
        SusRow[]
      >`select * from public.sus_responses where owner_id=${owner} and is_thesis_run=${scope === 'research'} limit 5000`;
    const [caseCount] = await tx<
      { count: number }[]
    >`select count(*)::int as count from public.evaluation_cases where owner_id=${owner} and is_thesis_run=${scope === 'research'}`;
    const [excludedCount] = await tx<
      { count: number }[]
    >`select count(*)::int as count from public.srs_generation_logs where owner_id=${owner} and not is_thesis_run`;
    const projects = await tx<
      { id: string; title: string }[]
    >`select p.id,p.title from public.projects p where p.owner_id=${owner} and p.status in ('in_review','finalized') and (${scope === 'dev'} or exists(select 1 from public.srs_generation_logs l where l.project_id=p.id and l.owner_id=p.owner_id and l.is_thesis_run and l.status='completed')) order by p.updated_at desc limit 201`;
    bounded(logs, 5000);
    bounded(sus, 5000);
    bounded(projects, 200);
    const describe = (values: number[]) => ({
      n: values.length,
      mean: values.length ? statistics(values).mean : null,
      median: values.length ? statistics(values).median : null,
      sd: values.length > 1 ? statistics(values).sd : null,
    });
    const dimensions = ['unambiguous', 'complete', 'correct', 'verifiable'].flatMap(
      (dimension, index) =>
        (['system', 'human'] as const).map((source) => {
          const perParticipant = new Map<string, number[]>();
          for (const r of reviews.filter((r) => r.source === source))
            perParticipant.set(r.participant_id, [
              ...(perParticipant.get(r.participant_id) ?? []),
              r.ratings[index]!,
            ]);
          return {
            source,
            dimension,
            statistics: describe(
              [...perParticipant.values()].map((values) => statistics(values).mean),
            ),
          };
        }),
    );
    return EvaluationOverviewSchema.parse({
      scope,
      design,
      counts: {
        logs: logs.length,
        reviews: reviews.length,
        sus: sus.length,
        cases: caseCount?.count ?? 0,
        excludedDev: excludedCount?.count ?? 0,
      },
      duration: describe(logs.map((r) => Number(r.execution_time_seconds))),
      completeness: describe(logs.map((r) => Number(r.structure_completeness_pct))),
      sus: describe(sus.map((r) => Number(r.score))),
      dimensions,
      eligibleProjects: projects,
    });
  });
}
