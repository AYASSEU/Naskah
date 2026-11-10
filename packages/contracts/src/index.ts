import { z } from 'zod';
import { CallbackBaseSchema } from './backend';
export * from './ai-connection';
export * from './backend';
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
  output_language: z.enum(['id', 'en']).optional(),
  templateId: z.string().optional(),
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
  needs_confirmation: z.boolean().optional(),
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
  version: z.number().int().positive().optional(),
  locked: z.boolean().optional(),
});
export type Section = z.infer<typeof SectionSchema>;
export const RetrievedChunkSchema = z.object({
  id: z.string(),
  dataset: z.enum(['PURE', 'PROMISE_exp', 'Kaggle', 'dev_seed']),
  similarity: z.number().min(0).max(1),
  excerpt: z.string(),
  doc_id: z.string().optional(),
  section: z.string().optional(),
  embedding_model: z.string().optional(),
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
  is_thesis_run: z.boolean().optional(),
  model: z.string().optional(),
  embedding_model: z.string().optional(),
  metrics: z.record(z.string(), z.unknown()).optional(),
});
export type GenerationLog = z.infer<typeof GenerationLogSchema>;
export const GenerateInputSchema = z.object({
  session_id: z.uuid(),
  project_title: z.string().min(1),
  domain: z.string().min(1),
  raw_text: z.string().min(1),
  run_id: z.uuid().optional(),
  output_language: z.enum(['id', 'en']).optional(),
  template_id: z.string().optional(),
  options: z
    .object({
      retrieval_k: z.number().int().min(5).max(8).optional(),
      model: z.string().optional(),
      temperature: z.number().min(0).max(2).optional(),
    })
    .optional(),
  resume: z
    .object({
      from_part: z.number().int().min(1).max(17),
      completed_sections: z.array(SectionSchema),
    })
    .optional(),
});
export type GenerateInput = z.infer<typeof GenerateInputSchema>;
export const ReviseInputSchema = z.object({
  session_id: z.uuid(),
  target_section: z.string().min(1),
  current_section_text: z.string(),
  user_instructions: z.string().min(1),
  revision_id: z.uuid().optional(),
  base_section_version: z.number().int().positive().optional(),
  output_language: z.enum(['id', 'en']).optional(),
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
  base_section_version: z.number().int().positive().optional(),
  chunks: z.array(RetrievedChunkSchema).optional(),
  guardrail: GuardrailSchema.optional(),
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
  author: z.string().trim().max(200).optional(),
  institution: z.string().trim().max(200).optional(),
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

export const ChapterDraftSchema = z.object({
  number: z.string().regex(/^\d+$/),
  title: z
    .string()
    .min(1)
    .regex(/^[^\r\n]+$/),
  sections: z
    .array(
      z.object({
        number: z.string().regex(/^\d+\.\d+$/),
        title: z
          .string()
          .min(1)
          .regex(/^[^\r\n]+$/),
        body: z.string(),
        requirements: z.array(RequirementSchema).default([]),
      }),
    )
    .min(1),
});
export type ChapterDraft = z.infer<typeof ChapterDraftSchema>;

export const ProjectCreateSchema = ProjectSchema.omit({
  id: true,
  ownerId: true,
  sessionId: true,
  createdAt: true,
  updatedAt: true,
})
  .extend({
    title: z.string().trim().min(1).max(300),
    domain: z.string().trim().min(1).max(100),
    version: z.string().min(1).max(30),
    rawText: z.string().max(2 * 1024 * 1024),
  })
  .strict();
export const ProjectPatchSchema = ProjectCreateSchema.partial().strict();
export const SectionWriteSchema = z
  .object({
    projectId: z.uuid(),
    section: SectionSchema.extend({ markdown: z.string().max(400000) }),
  })
  .strict();
export const DocumentWriteSchema = z
  .object({
    sections: z.array(SectionSchema).min(1).max(128),
    label: z.string().max(200).optional(),
  })
  .strict();
export const GenerationRequestSchema = GenerateInputSchema.extend({
  project_title: z.string().min(1).max(300),
  domain: z.string().min(1).max(100),
  raw_text: z
    .string()
    .min(1)
    .max(2 * 1024 * 1024),
});
export const RevisionRequestSchema = ReviseInputSchema.extend({
  target_section: z.string().min(1).max(200),
  current_section_text: z.string().max(400000),
  user_instructions: z.string().trim().min(1).max(8000),
});
export const GenerationAcceptedSchema = z.object({
  accepted: z.literal(true),
  session_id: z.uuid(),
  run_id: z.uuid(),
  project_id: z.uuid(),
  after_seq: z.number().int().nonnegative(),
  execution_id: z.string().nullable(),
});
export const RevisionAcceptedSchema = z.object({
  accepted: z.literal(true),
  revision_id: z.uuid(),
  session_id: z.uuid(),
  after_seq: z.number().int().nonnegative(),
});
export const OkSchema = z.object({ ok: z.literal(true) });
export const SectionVersionSchema = z.object({
  id: z.uuid(),
  version: z.number().int().positive(),
  label: z.string(),
  createdAt: z.string(),
  section: SectionSchema,
});
const EventFailureSchema = z.object({
  code: z.string(),
  retryable: z.boolean(),
  userMessage: z.string().optional(),
  userMessageKey: z.string().optional(),
});
export const WorkflowEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('stage'),
    stage: z.enum(['retrieving_context', 'drafting', 'guardrail', 'assembling', 'ready']),
    at: z.string(),
    substage: z.string().optional(),
  }),
  z.object({ type: z.literal('section_started'), sectionId: z.string() }),
  z.object({ type: z.literal('section_drafted'), sectionId: z.string(), markdown: z.string() }),
  z.object({ type: z.literal('guardrail_report'), sectionId: z.string(), report: GuardrailSchema }),
  z.object({ type: z.literal('retrieval_context'), chunks: z.array(RetrievedChunkSchema) }),
  z.object({ type: z.literal('failed'), stage: z.string().optional(), error: EventFailureSchema }),
  z.object({ type: z.literal('cancelled') }),
  z.object({ type: z.literal('completed'), document: DocumentSchema, log: GenerationLogSchema }),
  z.object({ type: z.literal('revision_ready'), revision: RevisionProposalSchema }),
  z.object({ type: z.literal('callback_failed') }),
]);

export const WorkflowReadyCallbackSchema = CallbackBaseSchema.extend({
  execution_id: z.string().min(1).max(100),
  markdown: z.string().min(1).max(4000000),
  document: DocumentSchema,
  metrics: z.record(z.string(), z.unknown()),
});
export const WorkflowRevisionCallbackSchema = CallbackBaseSchema.extend({
  execution_id: z.string().min(1).max(100),
  revision_id: z.uuid(),
  base_section_version: z.number().int().positive(),
  after: z.string().min(1).max(400000),
  retrievalQuery: z.string().max(12000),
  chunks: z.array(RetrievedChunkSchema),
  guardrail: GuardrailSchema,
  metrics: z.record(z.string(), z.unknown()),
});

export const ParsedDocumentSchema = z.object({
  name: z.string().max(255),
  text: z.string().max(2 * 1024 * 1024),
  pages: z.number().int().min(1).max(200),
  before: z.number().int().nonnegative(),
  after: z.number().int().nonnegative(),
  removed: z.number().int().nonnegative(),
  size: z.number().int().nonnegative(),
});
export const CompiledArtifactSchema = z.object({
  url: z.string().startsWith('/api/exports/'),
  filename: z.string(),
  size: z.number().int().positive(),
  format: z.enum(['docx', 'pdf']),
});
export const CompileResultSchema = z.discriminatedUnion('mode', [
  CompiledArtifactSchema.extend({ mode: z.literal('server') }),
  z.object({ mode: z.literal('client') }),
]);
