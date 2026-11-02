import { z } from 'zod';
export * from './ai-connection';
export const ProjectStatus = z.enum([
  'draft_input',
  'generating',
  'in_review',
  'finalized',
  'failed',
]);
export const ProjectSchema = z.object({
  id: z.uuid(),
  ownerId: z.string(),
  title: z.string().min(1),
  domain: z.string(),
  version: z.string(),
  status: ProjectStatus,
  createdAt: z.string(),
  updatedAt: z.string(),
  sessionId: z.uuid(),
  rawText: z.string(),
});
export type Project = z.infer<typeof ProjectSchema>;
export const RequirementSchema = z.object({
  id: z.string().regex(/^REQ-[A-Z]-\d+$/),
  title: z.string(),
  description: z.string(),
  actor: z.string(),
  input: z.string(),
  process: z.string(),
  output: z.string(),
  priority: z.enum(['High', 'Medium', 'Low']),
});
export type Requirement = z.infer<typeof RequirementSchema>;
export const RewriteSchema = z.object({
  id: z.string(),
  original: z.string(),
  rewritten: z.string(),
  reason: z.string(),
  resolved: z.boolean().default(false),
});
export const GuardrailSchema = z.object({
  dimensions: z.array(
    z.object({
      name: z.enum(['unambiguous', 'complete', 'correct', 'verifiable']),
      passed: z.boolean(),
      reason: z.string(),
    }),
  ),
  rewrites: z.array(RewriteSchema),
});
export type GuardrailReport = z.infer<typeof GuardrailSchema>;
export const SectionSchema = z.object({
  id: z.string(),
  number: z.string(),
  title: z.string(),
  markdown: z.string(),
  status: z.enum(['pending', 'generating', 'drafted', 'edited', 'revised', 'locked']),
  source: z.enum(['ai', 'human', 'ai_revised']),
  requirements: z.array(RequirementSchema),
  guardrail: GuardrailSchema,
  updatedAt: z.string(),
});
export type Section = z.infer<typeof SectionSchema>;
export const RetrievedChunkSchema = z.object({
  id: z.string(),
  dataset: z.enum(['PURE', 'PROMISE_exp', 'Kaggle']),
  similarity: z.number().min(0).max(1),
  excerpt: z.string(),
});
export type RetrievedChunk = z.infer<typeof RetrievedChunkSchema>;
export const DocumentSchema = z.object({
  projectId: z.uuid(),
  templateId: z.string(),
  sections: z.array(SectionSchema),
  metadata: z.object({
    title: z.string(),
    domain: z.string(),
    createdAt: z.string(),
    generationSeconds: z.number(),
  }),
  chunks: z.array(RetrievedChunkSchema),
});
export type SrsDocument = z.infer<typeof DocumentSchema>;
export const VersionSchema = z.object({
  id: z.uuid(),
  projectId: z.uuid(),
  createdAt: z.string(),
  label: z.string(),
  sections: z.array(SectionSchema),
});
export type DocumentVersion = z.infer<typeof VersionSchema>;
export const GenerationLogSchema = z.object({
  session_id: z.uuid(),
  project_title: z.string(),
  domain: z.string(),
  status: z.enum(['success', 'failed']),
  execution_time_seconds: z.number(),
  structure_completeness_pct: z.number().min(0).max(100),
  created_at: z.string(),
});
export type GenerationLog = z.infer<typeof GenerationLogSchema>;
export const GenerateInputSchema = z.object({
  session_id: z.uuid(),
  project_title: z.string().min(1),
  domain: z.string().min(1),
  raw_text: z.string().min(1),
});
export type GenerateInput = z.infer<typeof GenerateInputSchema>;
export const ReviseInputSchema = z.object({
  session_id: z.uuid(),
  target_section: z.string().min(1),
  current_section_text: z.string(),
  user_instructions: z.string().min(1),
});
export type ReviseInput = z.infer<typeof ReviseInputSchema>;
export const RevisionProposalSchema = z.object({
  id: z.uuid(),
  sectionId: z.string(),
  instruction: z.string(),
  before: z.string(),
  after: z.string(),
  retrievalQuery: z.string(),
  status: z.enum(['pending', 'accepted', 'rejected']),
});
export type RevisionProposal = z.infer<typeof RevisionProposalSchema>;
export const ChapterOutputSchema = z.object({
  section_title: z.string(),
  external_interfaces: z.string(),
  functional_requirements: z.array(RequirementSchema),
  performance_requirements: z.string(),
  security_requirements: z.string(),
});
export const ReadyCallbackSchema = z.object({
  session_id: z.uuid(),
  markdown: z.string().min(1),
  document: DocumentSchema,
});
export const ParseInputSchema = z.object({
  filename: z.string().regex(/\.(pdf|txt)$/i),
  content: z.string().min(1),
});
export const CompileInputSchema = z.object({
  documentId: z.uuid(),
  format: z.enum(['docx', 'pdf']),
});
export const ExpertReviewSchema = z.object({
  id: z.uuid(),
  reviewer: z.string().min(1),
  label: z.enum(['A', 'B']),
  ratings: z.array(z.number().int().min(1).max(5)).length(4),
  justifications: z.array(z.string().min(1)).length(4),
  comments: z.string(),
  createdAt: z.string(),
});
export type ExpertReview = z.infer<typeof ExpertReviewSchema>;
export const SusResponseSchema = z.object({
  id: z.uuid(),
  answers: z.array(z.number().int().min(1).max(5)).length(10),
  score: z.number().min(0).max(100),
  comment: z.string(),
  createdAt: z.string(),
});
export type SusResponse = z.infer<typeof SusResponseSchema>;
const RougeMetric = z.object({
  precision: z.number().min(0).max(1),
  recall: z.number().min(0).max(1),
  f1: z.number().min(0).max(1),
});
export const RougeSchema = z.object({
  scenario: z.string(),
  rouge1: RougeMetric,
  rouge2: RougeMetric,
  rougeL: RougeMetric,
});
export type RougeResult = z.infer<typeof RougeSchema>;
export const StatisticalResultSchema = z.object({
  test: z.enum(['wilcoxon', 'mann_whitney']),
  dimension: z.string(),
  n: z.number().int().positive(),
  statistic: z.number(),
  p_value: z.number().min(0).max(1),
  effect_size: z.number(),
});
export type StatisticalResult = z.infer<typeof StatisticalResultSchema>;
export const TemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  chapters: z.array(
    z.object({
      number: z.string(),
      title: z.string(),
      prompt: z.string(),
      subsections: z.array(
        z.object({ number: z.string(), title: z.string(), required: z.boolean() }),
      ),
    }),
  ),
});
export type SrsTemplate = z.infer<typeof TemplateSchema>;
