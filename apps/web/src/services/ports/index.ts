import type {
  Project,
  SrsDocument,
  Section,
  DocumentVersion,
  GenerateInput,
  ReviseInput,
  RevisionProposal,
  GuardrailReport,
  RetrievedChunk,
  GenerationLog,
  ExpertReview,
  SusResponse,
  RougeResult,
  StatisticalResult,
  AiConnectionSave,
  AiConnectionSnapshot,
  AiConnectionTest,
} from '@naskah/contracts';
import type { ExampleRepository } from './examples';
export class PortError extends Error {
  constructor(
    public code: string,
    public retryable: boolean,
    public userMessage: string,
  ) {
    super(userMessage);
  }
}
export class NotImplementedError extends PortError {
  constructor() {
    super('not_implemented', false, 'notImplemented');
  }
}
export type GenerationEvent =
  | {
      type: 'stage';
      stage: 'retrieving_context' | 'drafting' | 'guardrail' | 'assembling' | 'ready';
      at: string;
    }
  | { type: 'section_started'; sectionId: string }
  | { type: 'section_drafted'; sectionId: string; markdown: string }
  | { type: 'guardrail_report'; sectionId: string; report: GuardrailReport }
  | { type: 'retrieval_context'; chunks: RetrievedChunk[] }
  | { type: 'failed'; stage: string; error: PortError }
  | { type: 'completed'; document: SrsDocument; log: GenerationLog };
export interface GenerationHandle {
  subscribe(listener: (event: GenerationEvent) => void): () => void;
  cancel(): void;
  getSnapshot(): GenerationEvent[];
}
export interface ProjectRepository {
  list(): Promise<Project[]>;
  get(id: string): Promise<Project>;
  create(
    input: Omit<Project, 'id' | 'sessionId' | 'createdAt' | 'updatedAt' | 'ownerId'>,
  ): Promise<Project>;
  update(id: string, input: Partial<Project>): Promise<Project>;
  delete(id: string): Promise<void>;
}
export interface DocumentRepository {
  getDocument(id: string): Promise<SrsDocument>;
  saveSection(id: string, section: Section): Promise<void>;
  saveSections(id: string, sections: Section[], label?: string): Promise<void>;
  listVersions(id: string): Promise<DocumentVersion[]>;
  restoreVersion(id: string, versionId: string): Promise<void>;
}
export interface GenerationService {
  start(input: GenerateInput): GenerationHandle;
}
export interface RevisionService {
  requestRevision(input: ReviseInput): Promise<RevisionProposal>;
}
export interface ParsedDocument {
  name: string;
  text: string;
  pages: number;
  before: number;
  after: number;
  removed: number;
  size: number;
}
export interface ParserService {
  extractText(file: File): Promise<ParsedDocument>;
}
export interface CompiledArtifact {
  url: string;
  filename: string;
  size: number;
  format: 'docx' | 'pdf';
}
export interface CompilerService {
  compile(documentId: string, format: 'docx' | 'pdf'): Promise<CompiledArtifact>;
}
export interface EvaluationRepository {
  importStatisticalResults(results: StatisticalResult[]): Promise<void>;
  listStatisticalResults(): Promise<StatisticalResult[]>;
  logGeneration(log: GenerationLog): Promise<void>;
  listGenerationLogs(): Promise<GenerationLog[]>;
  saveExpertReview(review: ExpertReview): Promise<void>;
  listExpertReviews(): Promise<ExpertReview[]>;
  saveSusResponse(response: SusResponse): Promise<void>;
  listSusResponses(): Promise<SusResponse[]>;
  importRougeResults(results: RougeResult[]): Promise<void>;
  listRougeResults(): Promise<RougeResult[]>;
}
export interface PersistencePort {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
  clear(): Promise<void>;
}
export interface AuthPort {
  getCurrentUser(): Promise<{ id: string; name: string }>;
}
export interface TelemetryPort {
  track(event: string): Promise<void>;
}
export interface AiConnectionService {
  getSettings(): Promise<AiConnectionSnapshot>;
  saveSettings(input: AiConnectionSave): Promise<AiConnectionSnapshot>;
  removeApiKey(): Promise<AiConnectionSnapshot>;
  testConnection(): Promise<AiConnectionTest>;
}
export interface SimulationConfig {
  speed: 'instant' | 'normal' | 'slow';
  failure: 'none' | 'retrieval' | 'chapter3' | 'guardrail' | 'revision';
}
export interface Services {
  aiConnection: AiConnectionService;
  projects: ProjectRepository;
  documents: DocumentRepository;
  generation: GenerationService;
  revision: RevisionService;
  parser: ParserService;
  compiler: CompilerService;
  evaluation: EvaluationRepository;
  examples: ExampleRepository;
  auth: AuthPort;
  telemetry: TelemetryPort;
  reset(): Promise<void>;
  loadExamples(): Promise<void>;
  simulation: SimulationConfig;
  calls: { at: string; method: string }[];
  mode: 'mock' | 'live';
}
