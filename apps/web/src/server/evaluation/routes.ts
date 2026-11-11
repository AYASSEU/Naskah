import 'server-only';
import { z } from 'zod';
import {
  EvaluationScopeSchema,
  EvaluationConsentSchema,
  EvaluationCaseInputSchema,
  EvaluationReviewInputSchema,
  EvaluationSusInputSchema,
  EvaluationComputeSchema,
  EvaluationStatisticsInputSchema,
  StatisticalResultSchema,
} from '@naskah/contracts';
import { ownerRoute, readJson, json } from '../http/route';
import { AppError } from '../http/errors';
import { rateLimit } from '../http/rate-limit';
import { transaction } from '../db/client';
import { context, consent } from './participants';
import {
  bounded,
  cases,
  createCase,
  seedDev,
  blindDocuments,
  mapping,
  saveReview,
  saveSus,
  completedReviews,
  reviewDTO,
  susRows,
  susDTO,
  overview,
} from './data';
import {
  computeRouge,
  computeStats,
  importReport,
  statisticalReports,
  rougeResults,
  legacyImport,
  exportSnapshot,
  csv,
} from './reports';
export function evaluationRoute(request: Request, resource: string) {
  return ownerRoute(
    request,
    async (owner) => {
      if (request.method === 'POST')
        rateLimit(
          owner,
          'evaluation:' + resource,
          ['rouge', 'statistics', 'import'].includes(resource) ? 10 : 60,
        );
      const url = new URL(request.url),
        scope = EvaluationScopeSchema.parse(url.searchParams.get('scope') ?? 'dev'),
        method = request.method;
      if (resource === 'context' && method === 'GET')
        return json(await context(request, owner, scope));
      if (resource === 'context' && method === 'POST') {
        const result = await consent(
          request,
          owner,
          scope,
          await readJson(request, EvaluationConsentSchema),
        );
        return Response.json(result.data, {
          headers: { 'Set-Cookie': result.cookie, 'Cache-Control': 'no-store' },
        });
      }
      if (resource === 'overview' && method === 'GET')
        return json(
          await overview(
            owner,
            scope,
            z.enum(['paired', 'independent']).parse(url.searchParams.get('design') ?? 'paired'),
          ),
        );
      if (resource === 'cases' && method === 'GET') return json(await cases(owner, scope));
      if (resource === 'cases' && method === 'POST')
        return json(
          await createCase(owner, scope, await readJson(request, EvaluationCaseInputSchema)),
          201,
        );
      if (resource === 'seed' && method === 'POST') {
        if (scope !== 'dev') throw new AppError('dev_seed_excluded', 409);
        const { design } = await readJson(
          request,
          z.object({ design: z.enum(['paired', 'independent']).default('paired') }),
        );
        return json(await seedDev(owner, design));
      }
      if (resource === 'blind' && method === 'GET')
        return json(
          await blindDocuments(
            request,
            owner,
            scope,
            z.uuid().parse(url.searchParams.get('caseId')),
          ),
        );
      if (resource === 'mapping' && method === 'GET')
        return json(
          await mapping(request, owner, scope, z.uuid().parse(url.searchParams.get('caseId'))),
        );
      if (resource === 'reviews' && method === 'POST')
        return json(
          await saveReview(
            request,
            owner,
            scope,
            await readJson(request, EvaluationReviewInputSchema),
          ),
        );
      if (resource === 'reviews' && method === 'GET')
        return json(
          await transaction(async (tx) =>
            (await completedReviews(tx, owner, scope)).map(reviewDTO),
          ),
        );
      if (resource === 'sus' && method === 'POST')
        return json(
          await saveSus(request, owner, scope, await readJson(request, EvaluationSusInputSchema)),
        );
      if (resource === 'sus' && method === 'GET')
        return json((await susRows(owner, scope)).map(susDTO));
      if (resource === 'rouge' && method === 'POST')
        return json(
          await computeRouge(owner, scope, await readJson(request, EvaluationComputeSchema)),
        );
      if (resource === 'rouge' && method === 'GET') return json(await rougeResults(owner, scope));
      if (resource === 'statistics' && method === 'POST')
        return json(
          await computeStats(
            owner,
            scope,
            await readJson(request, EvaluationStatisticsInputSchema),
          ),
        );
      if (resource === 'statistics' && method === 'GET')
        return json(await statisticalReports(owner, scope));
      if (resource === 'statistics-legacy' && method === 'GET') {
        const rows = await transaction(
          (tx) =>
            tx<
              { result: unknown }[]
            >`select result from public.statistical_results where owner_id=${owner} and is_thesis_run=${scope === 'research'} order by created_at desc limit 201`,
        );
        return json(
          bounded(rows, 200).flatMap((r) => {
            const report = z
              .object({ results: z.array(StatisticalResultSchema) })
              .safeParse(r.result);
            return report.success ? report.data.results : [StatisticalResultSchema.parse(r.result)];
          }),
        );
      }
      if (resource === 'import' && method === 'POST')
        return json(await importReport(owner, scope, await readJson(request, z.unknown())));
      if (resource === 'legacy-import' && method === 'POST') {
        const input = await readJson(
          request,
          z.object({ kind: z.enum(['rouge', 'statistics']), results: z.unknown() }),
        );
        await legacyImport(owner, scope, input.kind, input.results);
        return json({ ok: true });
      }
      if (resource === 'export' && method === 'GET') {
        const format = z.enum(['json', 'csv']).parse(url.searchParams.get('format') ?? 'json'),
          dataset = z
            .enum(['logs', 'reviews', 'sus', 'rouge', 'statistics', 'cases'])
            .parse(url.searchParams.get('dataset') ?? 'logs'),
          design = z
            .enum(['paired', 'independent'])
            .parse(url.searchParams.get('design') ?? 'paired');
        const snapshot = await exportSnapshot(owner, scope, design);
        return new Response(
          format === 'json'
            ? JSON.stringify(snapshot, null, 2)
            : csv(snapshot.datasets[dataset] ?? []),
          {
            headers: {
              'Content-Type': format === 'json' ? 'application/json' : 'text/csv; charset=utf-8',
              'Content-Disposition': `attachment; filename="naskah-${scope}-${dataset}.${format}"`,
              'Cache-Control': 'private, no-store',
              'X-Content-Type-Options': 'nosniff',
            },
          },
        );
      }
      throw new AppError('not_found', 404);
    },
    undefined,
  );
}
