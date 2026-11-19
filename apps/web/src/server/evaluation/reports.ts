import 'server-only';
import { z } from 'zod';
import {
  RougeReportSchema,
  StatisticsReportSchema,
  RougeSchema,
  StatisticalResultSchema,
  EvaluationExportSchema,
  EvaluationProvenanceSchema,
  type EvaluationScope,
  type EvaluationComputeSchema,
  type EvaluationStatisticsInputSchema,
} from '@naskah/contracts';
import { transaction } from '../db/client';
import { AppError } from '../http/errors';
import { iso } from '../application/data';
import { evaluate } from './engine';
import { caseTx, completedReviews, statsInput, anon, bounded, type SusRow } from './data';
const canonical = (value: unknown): string =>
  JSON.stringify(
    value && typeof value === 'object'
      ? Array.isArray(value)
        ? value.map((v) => JSON.parse(canonical(v)))
        : Object.fromEntries(
            Object.entries(value)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([k, v]) => [k, JSON.parse(canonical(v))]),
          )
      : value,
  );
export async function computeRouge(
  owner: string,
  scope: EvaluationScope,
  input: z.infer<typeof EvaluationComputeSchema>,
) {
  const pairs = await transaction(async (tx) => {
    const rows = [];
    for (const id of [...new Set(input.caseIds)]) {
      const c = await caseTx(tx, owner, scope, id);
      rows.push({
        case_id: c.id,
        scenario: c.title,
        prediction: c.system_markdown,
        reference: c.human_markdown,
        language: c.language,
        reference_language: c.reference_language,
        override_reason: input.overrideReason,
        is_thesis_run: c.is_thesis_run,
      });
    }
    return rows;
  });
  const report = await evaluate(
    'rouge',
    {
      data_scope: scope,
      pairs,
      allow_language_mismatch: input.allowLanguageMismatch,
      use_stemmer: input.useStemmer,
    },
    RougeReportSchema,
  );
  await storeRouge(owner, scope, report);
  return report;
}
async function storeRouge(
  owner: string,
  scope: EvaluationScope,
  report: z.infer<typeof RougeReportSchema>,
) {
  await transaction(async (tx) => {
    await tx`select pg_advisory_xact_lock(hashtextextended(${'rouge:' + owner + ':' + scope + ':' + report.provenance.input_digest},0))`;
    for (const row of report.results) {
      if (!row.case_id) throw new AppError('evaluation_provenance_mismatch', 422);
      const c = await caseTx(tx, owner, scope, row.case_id);
      const [old] =
        await tx`select id from public.rouge_results where owner_id=${owner} and case_id=${row.case_id} and is_thesis_run=${scope === 'research'} and provenance->>'input_digest'=${report.provenance.input_digest}`;
      if (old) continue;
      await tx`insert into public.rouge_results(owner_id,project_id,case_id,scenario,rouge1,rouge2,rouge_l,language,reference_language,language_mismatch_override,is_thesis_run,provenance) values(${owner},${c.project_id},${c.id},${c.title},${JSON.stringify(row.rouge1)}::text::jsonb,${JSON.stringify(row.rouge2)}::text::jsonb,${JSON.stringify(row.rougeL)}::text::jsonb,${row.language},${row.reference_language},${!row.valid_comparison},${scope === 'research'},${JSON.stringify({ ...report.provenance, valid_comparison: row.valid_comparison, override_reason: row.override_reason, use_stemmer: row.use_stemmer, tokenizer: row.tokenizer })}::text::jsonb)`;
    }
  });
}
export async function computeStats(
  owner: string,
  scope: EvaluationScope,
  input: z.infer<typeof EvaluationStatisticsInputSchema>,
) {
  const data = await statsInput(owner, scope, input.design);
  const report = await evaluate(
    'stats',
    { ...data, design: input.design, seed: input.seed },
    StatisticsReportSchema,
  );
  await storeStats(owner, scope, report);
  return report;
}
async function storeStats(
  owner: string,
  scope: EvaluationScope,
  report: z.infer<typeof StatisticsReportSchema>,
) {
  return transaction(async (tx) => {
    await tx`select pg_advisory_xact_lock(hashtextextended(${'stats:' + owner + ':' + scope + ':' + report.provenance.input_digest},0))`;
    const [old] =
      await tx`select id from public.statistical_results where owner_id=${owner} and is_thesis_run=${scope === 'research'} and result->'provenance'->>'input_digest'=${report.provenance.input_digest}`;
    if (!old)
      await tx`insert into public.statistical_results(owner_id,result,is_thesis_run) values(${owner},${JSON.stringify(report)}::text::jsonb,${scope === 'research'})`;
  });
}
export async function importReport(owner: string, scope: EvaluationScope, raw: unknown) {
  const schema = z.discriminatedUnion('kind', [RougeReportSchema, StatisticsReportSchema]),
    report = schema.parse(raw);
  if (report.data_scope !== scope) throw new AppError('evaluation_scope_mismatch', 409);
  if (report.kind === 'statistics') {
    const input = {
      ...(await statsInput(owner, scope, report.design)),
      design: report.design,
      seed: report.seed,
    };
    const expected = await evaluate('stats', input, StatisticsReportSchema);
    if (canonical(report) !== canonical(expected))
      throw new AppError('evaluation_provenance_mismatch', 422);
    await storeStats(owner, scope, expected);
    return expected;
  }
  const reasons = [...new Set(report.results.map((r) => r.override_reason ?? ''))];
  if (reasons.length !== 1) throw new AppError('evaluation_provenance_mismatch', 422);
  const pairs = await transaction(async (tx) => {
    const rows = [];
    for (const row of report.results) {
      if (!row.case_id) throw new AppError('evaluation_provenance_mismatch', 422);
      const c = await caseTx(tx, owner, scope, row.case_id);
      rows.push({
        case_id: c.id,
        scenario: c.title,
        prediction: c.system_markdown,
        reference: c.human_markdown,
        language: c.language,
        reference_language: c.reference_language,
        override_reason: reasons[0],
        is_thesis_run: c.is_thesis_run,
      });
    }
    return rows;
  });
  const expected = await evaluate(
    'rouge',
    {
      data_scope: scope,
      pairs,
      allow_language_mismatch: report.results.some((r) => !r.valid_comparison),
      use_stemmer: report.results[0]!.use_stemmer,
    },
    RougeReportSchema,
  );
  if (canonical(report) !== canonical(expected))
    throw new AppError('evaluation_provenance_mismatch', 422);
  await storeRouge(owner, scope, expected);
  return expected;
}
export const statisticalReports = (owner: string, scope: EvaluationScope) =>
  transaction(async (tx) =>
    bounded(
      await tx<
        { result: unknown }[]
      >`select result from public.statistical_results where owner_id=${owner} and is_thesis_run=${scope === 'research'} order by created_at desc limit 201`,
      200,
    ).flatMap((r) => {
      const parsed = StatisticsReportSchema.safeParse(r.result);
      return parsed.success ? [parsed.data] : [];
    }),
  );
export const rougeResults = (owner: string, scope: EvaluationScope) =>
  transaction(async (tx) =>
    bounded(
      await tx<
        {
          scenario: string;
          rouge1: unknown;
          rouge2: unknown;
          rouge_l: unknown;
          language: string;
          reference_language: string;
          language_mismatch_override: boolean;
          provenance: unknown;
          case_id: string | null;
        }[]
      >`select scenario,rouge1,rouge2,rouge_l,language,reference_language,language_mismatch_override,provenance,case_id from public.rouge_results where owner_id=${owner} and is_thesis_run=${scope === 'research'} order by created_at desc limit 5001`,
      5000,
    ).map((r) => ({
      ...RougeSchema.parse({ ...r, rougeL: r.rouge_l }),
      valid_comparison: !r.language_mismatch_override,
      case_id: r.case_id,
      provenance: r.provenance,
      language: r.language,
      reference_language: r.reference_language,
    })),
  );
export async function legacyImport(
  owner: string,
  scope: EvaluationScope,
  kind: 'rouge' | 'statistics',
  raw: unknown,
) {
  if (scope !== 'dev') throw new AppError('evaluation_provenance_mismatch', 422);
  if (kind === 'statistics') {
    const rows = z.array(StatisticalResultSchema).max(200).parse(raw);
    await transaction(async (tx) => {
      for (const row of rows)
        await tx`insert into public.statistical_results(owner_id,result,is_thesis_run) values(${owner},${JSON.stringify({ ...row, unverified_development_import: true })}::text::jsonb,false)`;
    });
  } else {
    const rows = z.array(RougeSchema).max(200).parse(raw);
    await transaction(async (tx) => {
      for (const row of rows)
        await tx`insert into public.rouge_results(owner_id,scenario,rouge1,rouge2,rouge_l,language,reference_language,is_thesis_run,provenance) values(${owner},${row.scenario},${JSON.stringify(row.rouge1)}::text::jsonb,${JSON.stringify(row.rouge2)}::text::jsonb,${JSON.stringify(row.rougeL)}::text::jsonb,'id','id',false,'{"unverified_development_import":true}'::jsonb)`;
    });
  }
}
export async function exportSnapshot(
  owner: string,
  scope: EvaluationScope,
  design: 'paired' | 'independent' = 'paired',
) {
  const datasets = await transaction(async (tx) => {
    const reviews = await completedReviews(tx, owner, scope),
      sus = await tx<
        SusRow[]
      >`select * from public.sus_responses where owner_id=${owner} and is_thesis_run=${scope === 'research'} order by created_at limit 5001`;
    const logs = await tx<
      {
        session_id: string;
        project_id: string;
        status: string;
        execution_time_seconds: number;
        structure_completeness_pct: number;
        model: string;
        embedding_model: string;
        is_thesis_run: boolean;
        created_at: string;
      }[]
    >`select session_id,project_id,status,execution_time_seconds,structure_completeness_pct,model,embedding_model,is_thesis_run,created_at from public.srs_generation_logs where owner_id=${owner} and is_thesis_run=${scope === 'research'} order by created_at limit 5001`;
    const cases = await tx<
      {
        id: string;
        project_id: string;
        language: string;
        reference_language: string;
        is_thesis_run: boolean;
        study_design: string;
        created_at: string;
      }[]
    >`select id,project_id,language,reference_language,is_thesis_run,study_design,created_at from public.evaluation_cases where owner_id=${owner} and is_thesis_run=${scope === 'research'} order by created_at limit 201`;
    bounded(sus, 5000);
    bounded(logs, 5000);
    bounded(cases, 200);
    return {
      logs: logs.map((r) => ({
        session: anon(owner, scope, 'session', r.session_id),
        project: anon(owner, scope, 'project', r.project_id),
        status: r.status,
        seconds: Number(r.execution_time_seconds),
        completeness: Number(r.structure_completeness_pct),
        model: r.model,
        embedding_model: r.embedding_model,
        is_thesis_run: r.is_thesis_run,
        created_at: iso(r.created_at),
      })),
      reviews: reviews.map((r) => ({
        participant: anon(owner, scope, 'participant', r.participant_id),
        case_id: anon(owner, scope, 'case', r.case_id),
        source: r.source,
        design: r.study_design,
        ratings: r.ratings,
        is_thesis_run: r.is_thesis_run,
        created_at: iso(r.created_at),
      })),
      sus: sus.map((r) => ({
        participant: anon(owner, scope, 'participant', r.participant_id),
        project: r.project_id ? anon(owner, scope, 'project', r.project_id) : null,
        answers: r.answers,
        score: Number(r.score),
        is_thesis_run: r.is_thesis_run,
        created_at: iso(r.created_at),
      })),
      cases: cases.map((r) => ({
        case_id: anon(owner, scope, 'case', r.id),
        project: anon(owner, scope, 'project', r.project_id),
        language: r.language,
        reference_language: r.reference_language,
        design: r.study_design,
        is_thesis_run: r.is_thesis_run,
        created_at: iso(r.created_at),
      })),
    };
  });
  const rouge = await rougeResults(owner, scope),
    stats = await statisticalReports(owner, scope);
  return EvaluationExportSchema.parse({
    schema_version: 1,
    data_scope: scope,
    created_at: new Date().toISOString(),
    datasets: {
      ...datasets,
      rouge: rouge.map((r) => ({
        case_id: r.case_id ? anon(owner, scope, 'case', r.case_id) : null,
        rouge1: r.rouge1,
        rouge2: r.rouge2,
        rougeL: r.rougeL,
        valid_comparison: r.valid_comparison,
        language: r.language,
        reference_language: r.reference_language,
        provenance: EvaluationProvenanceSchema.safeParse(r.provenance).success
          ? EvaluationProvenanceSchema.parse(r.provenance)
          : null,
        is_thesis_run: scope === 'research',
      })),
      statistics: stats.flatMap((r) =>
        r.results.map((result) => ({
          ...result,
          design: r.design,
          unit: r.unit,
          seed: r.seed,
          correction: r.correction,
          alpha: r.alpha,
          provenance: r.provenance,
          is_thesis_run: scope === 'research',
        })),
      ),
    },
    stats_input: {
      data_scope: scope,
      design,
      reviews: datasets.reviews
        .filter((r) => r.design === design)
        .map((r) => ({
          participant: r.participant,
          case_id: r.case_id,
          source: r.source,
          ratings: r.ratings,
          is_thesis_run: r.is_thesis_run,
        })),
    },
    privacy:
      'HMAC pseudonyms; no raw IDs, participant codes, free text, manuscript or credentials.',
  });
}
export function csv(rows: Record<string, unknown>[]) {
  const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const cell = (value: unknown) => {
    let s =
      typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value ?? '');
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  return (
    '\uFEFF' +
    [
      keys.map(cell).join(','),
      ...rows.map((row) => keys.map((key) => cell(row[key])).join(',')),
    ].join('\r\n')
  );
}
