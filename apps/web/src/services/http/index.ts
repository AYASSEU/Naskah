import { z } from 'zod';
import {
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
  type GenerateInput,
} from '@naskah/contracts';
import type { Services, GenerationHandle, GenerationEvent } from '../ports';
import { NotImplementedError, PortError } from '../ports';
import { request } from './client';
import { watchEvents, eventError } from './stream';
import { parser } from '../client/parser';
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
    parser,
    compiler: createCompiler(documents, projects),
    aiConnection: {
      getSettings: unavailable,
      saveSettings: unavailable,
      removeApiKey: unavailable,
      testConnection: unavailable,
    },
    evaluation: {
      listGenerationLogs: () => request('/api/evaluation/logs', z.array(GenerationLogSchema)),
      async logGeneration() {
        /* Workflow callbacks own generation logs. */
      },
      importStatisticalResults: unavailable,
      listStatisticalResults: unavailable,
      saveExpertReview: unavailable,
      listExpertReviews: unavailable,
      saveSusResponse: unavailable,
      listSusResponses: unavailable,
      importRougeResults: unavailable,
      listRougeResults: unavailable,
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
      getBlindDocuments: unavailable,
      getBlindMapping: unavailable,
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
