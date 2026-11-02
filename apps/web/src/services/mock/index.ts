import { z } from 'zod';
import {
  ProjectSchema,
  DocumentSchema,
  GenerateInputSchema,
  ReviseInputSchema,
  ExpertReviewSchema,
  SusResponseSchema,
  RougeSchema,
  StatisticalResultSchema,
} from '@naskah/contracts';
import type {
  Project,
  SrsDocument,
  DocumentVersion,
  GenerationLog,
  ExpertReview,
  SusResponse,
  RougeResult,
  StatisticalResult,
} from '@naskah/contracts';
import type { Services, GenerationHandle, GenerationEvent, SimulationConfig } from '../ports';
import { PortError } from '../ports';
import { fixtureProjects, fixtureLogs, makeDocument } from './fixtures';
import { persistence } from './persistence';
import { humanBaseline } from './fixtures/baseline';
import { parser } from './parser';
import { createCompiler } from './compiler';
import { createMockAiConnection } from './ai-connection';
import { nextId } from '@/entities/requirement/parsing';
import { checkStructure } from '@/entities/evaluation/structure';
interface Database {
  version: 1;
  projects: Project[];
  documents: SrsDocument[];
  versions: DocumentVersion[];
  logs: GenerationLog[];
  reviews: ExpertReview[];
  sus: SusResponse[];
  rouge: RougeResult[];
  statistics: StatisticalResult[];
}
let db: Database | undefined;
let initialization: Promise<Database> | undefined;
const empty = (): Database => ({
  version: 1,
  projects: [],
  documents: [],
  versions: [],
  logs: [],
  reviews: [],
  sus: [],
  rouge: [],
  statistics: [],
});
async function database() {
  if (db) return db;
  if (!initialization)
    initialization = (async () => {
      const saved = await persistence.get<Database>('database');
      if (saved && saved.version !== 1)
        throw new PortError('schema_mismatch', false, 'schemaError');
      if (saved) {
        if (
          !z.array(ProjectSchema).safeParse(saved.projects).success ||
          !z.array(DocumentSchema).safeParse(saved.documents).success
        )
          throw new PortError('schema_mismatch', false, 'schemaError');
        db = saved;
      } else {
        db = empty();
        db.projects = structuredClone(fixtureProjects);
        db.documents = db.projects.map((p) => makeDocument(p));
        db.logs = structuredClone(fixtureLogs);
        await persistence.set('database', db);
      }
      return db;
    })().catch((error) => {
      initialization = undefined;
      throw error;
    });
  return initialization;
}
let queue: Promise<unknown> = Promise.resolve();
function mutate<T>(fn: (data: Database) => T | Promise<T>): Promise<T> {
  const task = queue.then(async () => {
    const current = await database();
    const copy = structuredClone(current);
    const result = await fn(copy);
    await persistence.set('database', copy);
    db = copy;
    return structuredClone(result);
  });
  queue = task.catch(() => {});
  return task;
}
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
export const simulation: SimulationConfig = { speed: 'normal', failure: 'none' };
const active = new Map<string, GenerationHandle>();
const sessions = new Map<string, GenerationHandle>();
const reservedRequirementIds = new Map<string, string[]>();
function reserveRequirementId(sessionId: string, markdown: string) {
  const reserved = reservedRequirementIds.get(sessionId) || [];
  const id = nextId(markdown + ' ' + reserved.join(' '));
  reservedRequirementIds.set(sessionId, [...reserved, id]);
  return id;
}
export function createMockServices(): Services {
  const aiConnection = createMockAiConnection(persistence);
  const calls: Services['calls'] = [];
  const track = (method: string) => {
    calls.unshift({ at: new Date().toISOString(), method });
    calls.splice(50);
  };
  const projects: Services['projects'] = {
    async list() {
      track('projects.list');
      return structuredClone((await database()).projects).sort((a, b) =>
        b.updatedAt.localeCompare(a.updatedAt),
      );
    },
    async get(id) {
      const p = (await database()).projects.find((p) => p.id === id);
      if (!p) throw new PortError('not_found', false, 'notFound');
      return structuredClone(p);
    },
    async create(input) {
      track('projects.create');
      return mutate((data) => {
        const now = new Date().toISOString();
        const p = ProjectSchema.parse({
          ...input,
          id: crypto.randomUUID(),
          sessionId: crypto.randomUUID(),
          ownerId: 'local',
          createdAt: now,
          updatedAt: now,
        });
        data.projects.push(p);
        data.documents.push(makeDocument(p, true));
        return p;
      });
    },
    async update(id, input) {
      return mutate((data) => {
        const index = data.projects.findIndex((p) => p.id === id);
        if (index < 0) throw new PortError('not_found', false, 'notFound');
        data.projects[index] = ProjectSchema.parse({
          ...data.projects[index],
          ...input,
          updatedAt: new Date().toISOString(),
        });
        return data.projects[index]!;
      });
    },
    async delete(id) {
      track('projects.delete');
      active.get(id)?.cancel();
      await mutate((data) => {
        data.projects = data.projects.filter((p) => p.id !== id);
        data.documents = data.documents.filter((d) => d.projectId !== id);
        data.versions = data.versions.filter((v) => v.projectId !== id);
      });
    },
  };
  const documents: Services['documents'] = {
    async getDocument(id) {
      track('documents.getDocument');
      const d = (await database()).documents.find((d) => d.projectId === id);
      if (!d) throw new PortError('not_found', false, 'notFound');
      return structuredClone(d);
    },
    async saveSection(id, section) {
      track('documents.saveSection');
      await mutate((data) => {
        const d = data.documents.find((d) => d.projectId === id)!;
        const old = d.sections.find((s) => s.id === section.id);
        if (old?.status === 'locked' && section.status !== 'drafted')
          throw new PortError('locked', false, 'locked');
        d.sections = d.sections.map((s) => (s.id === section.id ? section : s));
        const p = data.projects.find((p) => p.id === id)!;
        p.updatedAt = new Date().toISOString();
      });
    },
    async saveSections(id, sections, label = 'Perubahan disimpan') {
      track('documents.saveSections');
      await mutate((data) => {
        const d = data.documents.find((d) => d.projectId === id)!;
        data.versions.push({
          id: crypto.randomUUID(),
          projectId: id,
          createdAt: new Date().toISOString(),
          label,
          sections: structuredClone(d.sections),
        });
        d.sections = structuredClone(sections);
        data.projects.find((p) => p.id === id)!.updatedAt = new Date().toISOString();
      });
    },
    async listVersions(id) {
      return structuredClone(
        (await database()).versions.filter((v) => v.projectId === id).reverse(),
      );
    },
    async restoreVersion(id, versionId) {
      const version = (await database()).versions.find(
        (v) => v.projectId === id && v.id === versionId,
      );
      if (!version) throw new PortError('not_found', false, 'notFound');
      await documents.saveSections(id, version.sections, 'Versi dipulihkan');
    },
  };
  const evaluation: Services['evaluation'] = {
    async importStatisticalResults(results) {
      await mutate((data) => {
        data.statistics = z.array(StatisticalResultSchema).parse(results);
      });
    },
    async listStatisticalResults() {
      return structuredClone((await database()).statistics || []);
    },
    async logGeneration(log) {
      await mutate((data) => {
        data.logs.push(log);
      });
    },
    async listGenerationLogs() {
      return structuredClone((await database()).logs);
    },
    async saveExpertReview(review) {
      await mutate((data) => {
        data.reviews.push(ExpertReviewSchema.parse(review));
      });
    },
    async listExpertReviews() {
      return structuredClone((await database()).reviews);
    },
    async saveSusResponse(response) {
      await mutate((data) => {
        data.sus.push(SusResponseSchema.parse(response));
      });
    },
    async listSusResponses() {
      return structuredClone((await database()).sus);
    },
    async importRougeResults(results) {
      await mutate((data) => {
        data.rouge = z.array(RougeSchema).parse(results);
      });
    },
    async listRougeResults() {
      return structuredClone((await database()).rouge);
    },
  };
  const generation: Services['generation'] = {
    start(raw) {
      track('generation.start');
      const input = GenerateInputSchema.parse(raw);
      const existing = sessions.get(input.session_id);
      if (existing) return existing;
      const listeners = new Set<(e: GenerationEvent) => void>();
      const events: GenerationEvent[] = [];
      let cancelled = false;
      let projectId = '';
      const emit = (e: GenerationEvent) => {
        events.push(e);
        listeners.forEach((l) => l(e));
      };
      const handle: GenerationHandle = {
        subscribe(l) {
          listeners.add(l);
          return () => listeners.delete(l);
        },
        getSnapshot() {
          return [...events];
        },
        cancel() {
          cancelled = true;
          if (projectId) void projects.update(projectId, { status: 'failed' }).catch(() => {});
          emit({
            type: 'failed',
            stage: 'cancelled',
            error: new PortError('cancelled', true, 'cancelled'),
          });
          active.delete(projectId);
        },
      };
      sessions.set(input.session_id, handle);
      void (async () => {
        let currentStage = 'retrieving_context';
        const started = Date.now();
        try {
          const data = await database();
          const p = data.projects.find((p) => p.sessionId === input.session_id);
          if (!p) throw new PortError('not_found', false, 'notFound');
          projectId = p.id;
          if (active.has(p.id)) {
            const existing = active.get(p.id)!;
            existing.getSnapshot().forEach(emit);
            existing.subscribe(emit);
            return;
          }
          active.set(p.id, handle);
          await projects.update(p.id, { status: 'generating' });
          const full = makeDocument({ ...p, status: 'in_review' });
          let stepNumber = 0;
          const step = () =>
            wait(
              simulation.speed === 'instant'
                ? 15
                : simulation.speed === 'slow'
                  ? 7000
                  : 3600 + (++stepNumber % 4) * 230,
            );
          emit({ type: 'stage', stage: 'retrieving_context', at: new Date().toISOString() });
          await step();
          if (cancelled) return;
          if (simulation.failure === 'retrieval')
            throw new PortError('retrieval_failed', true, 'generationError');
          emit({ type: 'retrieval_context', chunks: full.chunks });
          currentStage = 'drafting';
          emit({ type: 'stage', stage: 'drafting', at: new Date().toISOString() });
          for (const chapter of ['1', '2', '3', '4']) {
            const current = await documents.getDocument(p.id);
            const targets = full.sections.filter(
              (s) =>
                s.number.startsWith(chapter + '.') &&
                current.sections.find((old) => old.id === s.id)?.status === 'pending',
            );
            if (!targets.length) continue;
            emit({ type: 'section_started', sectionId: chapter });
            await step();
            if (cancelled) return;
            if (chapter === '3' && simulation.failure === 'chapter3')
              throw new PortError('chapter_failed', true, 'generationError');
            for (const s of targets) {
              await documents.saveSection(p.id, s);
              emit({ type: 'section_drafted', sectionId: s.id, markdown: s.markdown });
              emit({ type: 'guardrail_report', sectionId: s.id, report: s.guardrail });
            }
          }
          currentStage = 'guardrail';
          emit({ type: 'stage', stage: 'guardrail', at: new Date().toISOString() });
          await step();
          if (cancelled) return;
          if (simulation.failure === 'guardrail')
            throw new PortError('guardrail_failed', true, 'generationError');
          emit({ type: 'stage', stage: 'assembling', at: new Date().toISOString() });
          await step();
          if (cancelled) return;
          const doc = await documents.getDocument(p.id);
          doc.metadata.generationSeconds = (Date.now() - started) / 1000;
          await mutate((data) => {
            data.documents = data.documents.map((d) => (d.projectId === p.id ? doc : d));
          });
          const log: GenerationLog = {
            session_id: p.sessionId,
            project_title: p.title,
            domain: p.domain,
            status: 'success',
            execution_time_seconds: doc.metadata.generationSeconds,
            structure_completeness_pct: checkStructure(
              doc.sections
                .map(
                  (s) =>
                    `# ${s.number.split('.')[0]}. ${s.title}\n## ${s.number} ${s.title}\n${s.markdown}`,
                )
                .join('\n'),
            ).percentage,
            created_at: new Date().toISOString(),
          };
          await evaluation.logGeneration(log);
          await projects.update(p.id, { status: 'in_review' });
          emit({ type: 'stage', stage: 'ready', at: new Date().toISOString() });
          emit({ type: 'completed', document: doc, log });
        } catch (error) {
          if (projectId) {
            await projects.update(projectId, { status: 'failed' });
            const p = await projects.get(projectId);
            await evaluation.logGeneration({
              session_id: p.sessionId,
              project_title: p.title,
              domain: p.domain,
              status: 'failed',
              execution_time_seconds: (Date.now() - started) / 1000,
              structure_completeness_pct: Math.round(
                ((await documents.getDocument(p.id)).sections.filter((s) => s.status !== 'pending')
                  .length /
                  15) *
                  100,
              ),
              created_at: new Date().toISOString(),
            });
          }
          emit({
            type: 'failed',
            stage: currentStage,
            error:
              error instanceof PortError
                ? error
                : new PortError('generation_failed', true, 'generationError'),
          });
        } finally {
          active.delete(projectId);
          sessions.delete(input.session_id);
        }
      })();
      return handle;
    },
  };
  const revision: Services['revision'] = {
    async requestRevision(raw) {
      track('revision.requestRevision');
      const input = ReviseInputSchema.parse(raw);
      await wait(simulation.speed === 'instant' ? 30 : 2200);
      if (simulation.failure === 'revision')
        throw new PortError('revision_timeout', true, 'revisionError');
      const sectionId = input.target_section.split(' ')[0]!;
      const instruction = input.user_instructions;
      const project = (await database()).projects.find((p) => p.sessionId === input.session_id);
      const allText = project
        ? (await documents.getDocument(project.id)).sections.map((s) => s.markdown).join('\n')
        : input.current_section_text;
      let addition: string;
      if (/2.?factor|2fa|AES|enkripsi/i.test(instruction))
        addition =
          'Pengguna wajib melakukan autentikasi dua faktor (2FA) dengan kode TOTP berjangka 30 detik. Data sensitif dienkripsi menggunakan AES-256 saat disimpan dan TLS 1.3 saat dikirim.';
      else if (/qris/i.test(instruction))
        addition =
          'Pembayaran mendukung QRIS dinamis. Kode berlaku selama 5 menit. Sistem memverifikasi callback penyedia dan memperbarui status transaksi paling lambat 5 detik setelah konfirmasi.';
      else if (/audit/i.test(instruction))
        addition =
          'Setiap upaya autentikasi dicatat dengan identitas pengguna, waktu UTC, alamat IP, dan hasil verifikasi. Catatan audit disimpan selama 90 hari dan hanya dapat dibaca administrator kepatuhan.';
      else
        addition = `Klausul tambahan simulasi, untuk diverifikasi penulis: ${instruction.trim()}. Kriteria penerimaan dan ambang pengujian perlu dikonfirmasi kepada pemangku kepentingan.`;
      return {
        id: crypto.randomUUID(),
        sectionId,
        instruction,
        before: input.current_section_text,
        after: `${input.current_section_text}\n\n**${reserveRequirementId(input.session_id, allText)} — ${/qris/i.test(instruction) ? 'Pembayaran QRIS' : 'Ketentuan tambahan'}**\n${addition}`,
        retrievalQuery: `${instruction} measurable acceptance criteria requirements`,
        status: 'pending',
      };
    },
  };
  const services: Services = {
    aiConnection,
    projects,
    documents,
    generation,
    revision,
    parser,
    examples: {
      async listSamples() {
        return fixtureProjects.map((p) => ({
          title: p.title,
          domain: p.domain,
          version: p.version,
          rawText: p.rawText,
        }));
      },
      async getBlindDocuments() {
        return [
          {
            label: 'A',
            markdown: makeDocument(fixtureProjects[0]!).sections.find((s) => s.id === '3.2')!
              .markdown,
          },
          { label: 'B', markdown: humanBaseline },
        ];
      },
      async getBlindMapping() {
        return { A: 'system_simulated', B: 'human_synthetic_sample' };
      },
    },
    compiler: createCompiler(documents, projects),
    evaluation,
    auth: {
      async getCurrentUser() {
        return { id: 'local', name: 'Penulis lokal' };
      },
    },
    telemetry: { async track() {} },
    async reset() {
      await aiConnection.reset();
      reservedRequirementIds.clear();
      for (const handle of active.values()) handle.cancel();
      await queue.catch(() => {});
      const clean = empty();
      await persistence.set('database', clean);
      db = clean;
      initialization = undefined;
    },
    async loadExamples() {
      await mutate((data) => {
        for (const p of fixtureProjects)
          if (!data.projects.some((old) => old.id === p.id)) {
            data.projects.push(structuredClone(p));
            data.documents.push(makeDocument(p));
          }
        if (!data.logs.length) data.logs = structuredClone(fixtureLogs);
      });
    },
    simulation,
    calls,
    mode: 'mock',
  };
  return services;
}
