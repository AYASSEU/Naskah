import type { z } from 'zod';
import type {
  EvaluationScope,
  EvaluationConsentSchema,
  EvaluationContextSchema,
  EvaluationCase,
  EvaluationCaseInputSchema,
  BlindDocumentSchema,
  EvaluationReviewInputSchema,
  EvaluationSusInputSchema,
  EvaluationOverviewSchema,
  EvaluationComputeSchema,
  EvaluationStatisticsInputSchema,
  RougeResult,
  RougeReport,
  StatisticsReport,
  SusResponse,
  ExpertReview,
} from '@naskah/contracts';
export interface ResearchService {
  context(scope: EvaluationScope): Promise<z.infer<typeof EvaluationContextSchema>>;
  consent(
    scope: EvaluationScope,
    input: z.infer<typeof EvaluationConsentSchema>,
  ): Promise<z.infer<typeof EvaluationContextSchema>>;
  overview(
    scope: EvaluationScope,
    design?: 'paired' | 'independent',
  ): Promise<z.infer<typeof EvaluationOverviewSchema>>;
  cases(scope: EvaluationScope): Promise<EvaluationCase[]>;
  createCase(
    scope: EvaluationScope,
    input: z.infer<typeof EvaluationCaseInputSchema>,
  ): Promise<EvaluationCase>;
  seedDev(design: 'paired' | 'independent'): Promise<EvaluationCase>;
  blind(scope: EvaluationScope, caseId: string): Promise<z.infer<typeof BlindDocumentSchema>[]>;
  mapping(scope: EvaluationScope, caseId: string): Promise<Record<string, string>>;
  saveSus(
    scope: EvaluationScope,
    input: z.infer<typeof EvaluationSusInputSchema>,
  ): Promise<SusResponse>;
  saveReview(
    scope: EvaluationScope,
    input: z.infer<typeof EvaluationReviewInputSchema>,
  ): Promise<ExpertReview>;
  rouge(scope: EvaluationScope): Promise<(RougeResult & { valid_comparison: boolean })[]>;
  scoreRouge(
    scope: EvaluationScope,
    input: z.infer<typeof EvaluationComputeSchema>,
  ): Promise<RougeReport>;
  statistics(scope: EvaluationScope): Promise<StatisticsReport[]>;
  computeStatistics(
    scope: EvaluationScope,
    input: z.infer<typeof EvaluationStatisticsInputSchema>,
  ): Promise<StatisticsReport>;
  importReport(scope: EvaluationScope, input: unknown): Promise<RougeReport | StatisticsReport>;
  exportUrl(
    scope: EvaluationScope,
    dataset: 'logs' | 'reviews' | 'sus' | 'rouge' | 'statistics' | 'cases',
    format: 'json' | 'csv',
    design?: 'paired' | 'independent',
  ): string;
}
