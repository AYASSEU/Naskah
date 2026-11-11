import { z } from 'zod';
import {
  EvaluationContextSchema,
  EvaluationCaseSchema,
  EvaluationOverviewSchema,
  BlindDocumentSchema,
  ExpertReviewSchema,
  SusResponseSchema,
  RougeSchema,
  RougeReportSchema,
  StatisticsReportSchema,
} from '@naskah/contracts';
import type { ResearchService } from '../research';
import { request } from './client';
const path = (resource: string, scope: string) => `/api/evaluation/${resource}?scope=${scope}`;
const post = (body: unknown) => ({ method: 'POST', body: JSON.stringify(body) });
export const research: ResearchService = {
  context: (scope) => request(path('context', scope), EvaluationContextSchema),
  consent: (scope, input) => request(path('context', scope), EvaluationContextSchema, post(input)),
  overview: (scope,design='paired') => request(path('overview', scope)+'&design='+design, EvaluationOverviewSchema),
  cases: (scope) => request(path('cases', scope), z.array(EvaluationCaseSchema)),
  createCase: (scope, input) => request(path('cases', scope), EvaluationCaseSchema, post(input)),
  seedDev: (design) => request(path('seed', 'dev'), EvaluationCaseSchema, post({ design })),
  blind: (scope, id) =>
    request(
      path('blind', scope) + '&caseId=' + encodeURIComponent(id),
      z.array(BlindDocumentSchema),
    ),
  mapping: (scope, id) =>
    request(
      path('mapping', scope) + '&caseId=' + encodeURIComponent(id),
      z.record(z.string(), z.string()),
    ),
  saveSus: (scope, input) => request(path('sus', scope), SusResponseSchema, post(input)),
  saveReview: (scope, input) => request(path('reviews', scope), ExpertReviewSchema, post(input)),
  rouge: (scope) =>
    request(path('rouge', scope), z.array(RougeSchema.extend({ valid_comparison: z.boolean() }))),
  scoreRouge: (scope, input) => request(path('rouge', scope), RougeReportSchema, post(input)),
  statistics: (scope) => request(path('statistics', scope), z.array(StatisticsReportSchema)),
  computeStatistics: (scope, input) =>
    request(path('statistics', scope), StatisticsReportSchema, post(input)),
  importReport: (scope, input) =>
    request(
      path('import', scope),
      z.discriminatedUnion('kind', [RougeReportSchema, StatisticsReportSchema]),
      post(input),
    ),
  exportUrl: (scope, dataset, format, design = 'paired') =>
    path('export', scope) + `&dataset=${dataset}&format=${format}&design=${design}`,
};
