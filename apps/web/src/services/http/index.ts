import { z } from 'zod';
import { research } from './research';
import {
  ParsedDocumentSchema,
  CompileResultSchema,
  ProjectSchema,
  ProjectCreateSchema,
  ProjectPatchSchema,
  DocumentSchema,
  SectionSchema,
  VersionSchema,
  GenerateInputSchema,
  ReviseInputSchema,
  AiConnectionSaveSchema,
  IntegrationStateSchema,
  SystemStatusSchema,
  GenerationAcceptedSchema,
  RevisionAcceptedSchema,
  RevisionProposalSchema,
  OkSchema,
  GenerationLogSchema,
  StatisticalResultSchema,
  ExpertReviewSchema,
  SusResponseSchema,
  RougeSchema,
  type GenerateInput,
} from '@naskah/contracts';
import type { Services, GenerationHandle, GenerationEvent } from '../ports';
import { NotImplementedError, PortError } from '../ports';
import { request } from './client';
import { watchEvents, eventError } from './stream';
import { createCompiler } from '../client/compiler';
import { fixtureProjects } from '../mock/fixtures';
export const endpoints = {
  generate: '/api/generations',
  revise: '/api/revisions',
  parser: '/api/parse-pdf',
  compiler: '/api/compile-document',
  callback: '/api/webhooks/srs-ready',
  aiSettings: '/api/ai/settings',
  aiConnectionTest: '/api/ai/test-connection',
};
export const buildGenerateRequest = (input: unknown) => GenerateInputSchema.parse(input);
export const buildRevisionRequest = (input: unknown) => ReviseInputSchema.parse(input);
export const buildAiSettingsRequest = (input: unknown) => AiConnectionSaveSchema.parse(input);
const unavailable = async () => {
  throw new NotImplementedError();
};
export function createHttpServices(): Services {
  const handles = new Map<string, GenerationHandle>();
  const calls: Services['calls'] = [];
  const track = (method: string) => {
    calls.unshift({ at: new Date().toISOString(), method });
    calls.splice(50);
  };
  const startHandle = (
    input: GenerateInput,
    accepted: Promise<z.infer<typeof GenerationAcceptedSchema>>,
  ): GenerationHandle => {
    const listeners = new Set<(event: GenerationEvent) => void>(),
      events: GenerationEvent[] = [],
      controller = new AbortController();
    let terminal = false;
    const emit = (event: GenerationEvent) => {
      if (terminal) return;
      events.push(event);
      listeners.forEach((listener) => listener(event));
      if (event.type === 'completed' || event.type === 'failed') {
        terminal = true;
        handles.delete(input.session_id);
        controller.abort();
      }
    };
    const handle: GenerationHandle = {
      subscribe(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      getSnapshot: () => [...events],
      cancel() {
        void request(`/api/generations/${input.session_id}/cancel`, OkSchema, {
          method: 'POST',
        }).catch((error) =>
          emit({
            type: 'failed',
            stage: 'cancelled',
            error:
              error instanceof PortError
                ? error
                : new PortError('unknown', true, 'backendErrors.unknown'),
          }),
        );
      },
    };
    handles.set(input.session_id, handle);
    void (async () => {
      try {
        const run = await accepted;
        await watchEvents(
          `/api/generations/${run.session_id}/events`,
          run.after_seq,
          (event) => {
            if (event.type === 'failed') {
              emit({ type: 'failed', stage: event.stage ?? 'unknown', error: eventError(event) });
              return true;
            }
            if (event.type === 'cancelled') {
              emit({
                type: 'failed',
                stage: 'cancelled',
                error: new PortError('cancelled', true, 'backendErrors.cancelled'),
              });
              return true;
            }
            if (event.type === 'callback_failed') {
              emit({
                type: 'failed',
                stage: 'callback',
                error: new PortError('callback_failed', true, 'backendErrors.callback_failed'),
              });
              return true;
            }
            if (event.type !== 'revision_ready') emit(event);
            return event.type === 'completed';
          },
          controller.signal,
        );
      } catch (error) {
        emit({
          type: 'failed',
          stage: 'retrieving_context',
          error:
            error instanceof PortError
              ? error
              : new PortError('unknown', true, 'backendErrors.unknown'),
        });
      }
    })();
    return handle;
  };
  const projects: Services['projects'] = {
    list: () => request('/api/projects', z.array(ProjectSchema)),
    get: (id) => request(`/api/projects/${id}`, ProjectSchema),
    create: (input) =>
      request('/api/projects', ProjectSchema, {
        method: 'POST',
        body: JSON.stringify(ProjectCreateSchema.parse(input)),
      }),
    update: (id, input) =>
      request(`/api/projects/${id}`, ProjectSchema, {
        method: 'PATCH',
        body: JSON.stringify(ProjectPatchSchema.parse(input)),
      }),
    async delete(id) {
      await request(`/api/projects/${id}`, OkSchema, { method: 'DELETE' });
    },
  };
  const documents: Services['documents'] = {
    getDocument: (id) => request(`/api/documents/${id}`, DocumentSchema),
    async saveSection(id, section) {
      await request(`/api/sections/${encodeURIComponent(section.id)}`, SectionSchema, {
        method: 'PUT',
        headers: { 'If-Match': String(section.version ?? '') },
        body: JSON.stringify({ projectId: id, section }),
      });
    },
    async saveSections(id, sections, label) {
      await request(`/api/documents/${id}/versions`, DocumentSchema, {
        method: 'POST',
        body: JSON.stringify({ sections, label }),
      });
    },
    listVersions: (id) => request(`/api/documents/${id}/versions`, z.array(VersionSchema)),
    async restoreVersion(id, versionId) {
      await request(`/api/documents/${id}/versions/${versionId}/restore`, DocumentSchema, {
        method: 'POST',
      });
    },
  };
  return {
    integrations: {
      status: () => request('/api/system/status', SystemStatusSchema),
      get: (id) => request(`/api/settings/integrations/${id}`, IntegrationStateSchema),
      save: (id, input) =>
        request(`/api/settings/integrations/${id}`, IntegrationStateSchema, {
          method: 'PUT',
          body: JSON.stringify(input),
        }),
      test: (id) =>
        request(`/api/settings/integrations/${id}/test`, IntegrationStateSchema, {
          method: 'POST',
        }),
      remove: (id) =>
        request(`/api/settings/integrations/${id}`, IntegrationStateSchema, { method: 'DELETE' }),
      async reapply() {
        await request('/api/settings/integrations/reapply', OkSchema, { method: 'POST' });
      },
    },
    projects,
    documents,
    generation: {
      start(raw) {
        track('generation.start');
        const input = buildGenerateRequest(raw);
        return (
          handles.get(input.session_id) ??
          startHandle(
            input,
            request('/api/generations', GenerationAcceptedSchema, {
              method: 'POST',
              body: JSON.stringify(input),
            }),
          )
        );
      },
      async resume(raw) {
        const input = buildGenerateRequest(raw);
        const accepted = await request(
          `/api/generations/${input.session_id}/resume`,
          GenerationAcceptedSchema,
          { method: 'POST' },
        );
        startHandle(input, Promise.resolve(accepted));
      },
    },
    revision: {
      async requestRevision(raw) {
        track('revision.requestRevision');
        const input = buildRevisionRequest(raw),
          accepted = await request('/api/revisions', RevisionAcceptedSchema, {
            method: 'POST',
            body: JSON.stringify(input),
          });
        const controller = new AbortController();
        let result: z.infer<typeof RevisionProposalSchema> | undefined;
        try {
          await watchEvents(
            `/api/generations/${accepted.session_id}/events?scope=revision&ref=${accepted.revision_id}`,
            accepted.after_seq,
            (event) => {
              if (event.type === 'revision_ready') {
                result = event.revision;
                return true;
              }
              if (event.type === 'failed') throw eventError(event);
              if (event.type === 'callback_failed')
                throw new PortError('callback_failed', false, 'backendErrors.callback_failed');
              if (event.type === 'cancelled')
                throw new PortError('cancelled', false, 'backendErrors.cancelled');
              return false;
            },
            controller.signal,
          );
        } finally {
          controller.abort();
        }
        if (!result) throw new PortError('unknown', true, 'backendErrors.unknown');
        return result;
      },
      acceptRevision: (id) =>
        request(`/api/revisions/${id}/accept`, SectionSchema, { method: 'POST' }),
      async rejectRevision(id) {
        await request(`/api/revisions/${id}/reject`, OkSchema, { method: 'POST' });
      },
      listPending: (id) =>
        request(`/api/revisions?projectId=${id}`, z.array(RevisionProposalSchema)),
    },
    parser: {
      async extractText(file) {
        const body = new FormData();
        body.set('file', file);
        return request(endpoints.parser, ParsedDocumentSchema, { method: 'POST', body });
      },
    },
    compiler: {
      async compile(documentId, format, cover) {
        const result = await request(endpoints.compiler, CompileResultSchema, {
          method: 'POST',
          body: JSON.stringify({ documentId, format, ...cover }),
        });
        return result.mode === 'client'
          ? createCompiler(documents, projects).compile(documentId, format)
          : result;
      },
    },
    aiConnection: {
      getSettings: unavailable,
      saveSettings: unavailable,
      removeApiKey: unavailable,
      testConnection: unavailable,
    },
    research,
    evaluation: {
      listGenerationLogs: () => request('/api/evaluation/logs', z.array(GenerationLogSchema)),
      async logGeneration() {
        /* Workflow callbacks own generation logs. */
      },
      importStatisticalResults: async (results) => {
        await request('/api/evaluation/legacy-import?scope=dev', OkSchema, {
          method: 'POST',
          body: JSON.stringify({ kind: 'statistics', results }),
        });
      },
      listStatisticalResults: () =>
        request('/api/evaluation/statistics-legacy?scope=dev', z.array(StatisticalResultSchema)),
      saveExpertReview: async (review) => {
        const c = (await research.cases('dev'))[0];
        if (!c) throw new PortError('not_found', false, 'backendErrors.not_found');
        const assignment = (await research.blind('dev', c.id)).find(
          (d) => d.label === review.label,
        );
        if (!assignment) throw new PortError('not_found', false, 'backendErrors.not_found');
        await research.saveReview('dev', {
          assignmentId: assignment.id,
          ratings: review.ratings,
          justifications: review.justifications,
          comments: review.comments,
        });
      },
      listExpertReviews: () =>
        request('/api/evaluation/reviews?scope=dev', z.array(ExpertReviewSchema)),
      saveSusResponse: async (response) => {
        await research.saveSus('dev', response);
      },
      listSusResponses: () => request('/api/evaluation/sus?scope=dev', z.array(SusResponseSchema)),
      importRougeResults: async (results) => {
        await request('/api/evaluation/legacy-import?scope=dev', OkSchema, {
          method: 'POST',
          body: JSON.stringify({ kind: 'rouge', results }),
        });
      },
      listRougeResults: () => request('/api/evaluation/rouge?scope=dev', z.array(RougeSchema)),
    },
    examples: {
      async listSamples() {
        return fixtureProjects.map(({ title, domain, version, rawText }) => ({
          title,
          domain,
          version,
          rawText,
        }));
      },
      async getBlindDocuments() {
        const cases = await research.cases('dev');
        return cases[0]
          ? (await research.blind('dev', cases[0].id)).map(({ label, markdown }) => ({
              label,
              markdown,
            }))
          : [];
      },
      async getBlindMapping() {
        const cases = await research.cases('dev');
        if (!cases[0]) throw new PortError('not_found', false, 'backendErrors.not_found');
        const mapping = await research.mapping('dev', cases[0].id);
        return { A: mapping.A ?? '', B: mapping.B ?? '' };
      },
    },
    auth: {
      getCurrentUser: () =>
        request('/api/auth/session', z.object({ id: z.string(), name: z.string() }), {
          headers: { 'X-Naskah-Client': 'web' },
        }),
    },
    telemetry: { async track() {} },
    reset: unavailable,
    async loadExamples() {
      const existing = await projects.list();
      for (const sample of fixtureProjects) {
        const title = 'Contoh: ' + sample.title;
        if (!existing.some((p) => p.title === title))
          await projects.create({
            title,
            domain: sample.domain,
            version: sample.version,
            rawText: sample.rawText,
            status: 'draft_input',
          });
      }
    },
    simulation: { speed: 'normal', failure: 'none' },
    calls,
    mode: 'live',
  };
}
