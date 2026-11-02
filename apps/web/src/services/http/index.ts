import type { Services } from '../ports';
import { NotImplementedError } from '../ports';
import { GenerateInputSchema, ReviseInputSchema, AiConnectionSaveSchema } from '@naskah/contracts';
export const endpoints = {
  generate: '/webhook/generate-srs',
  revise: '/webhook/revise-srs',
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
  return {
    aiConnection: {
      getSettings: unavailable,
      saveSettings: unavailable,
      removeApiKey: unavailable,
      testConnection: unavailable,
    },
    projects: {
      list: unavailable,
      get: unavailable,
      create: unavailable,
      update: unavailable,
      delete: unavailable,
    },
    documents: {
      getDocument: unavailable,
      saveSection: unavailable,
      saveSections: unavailable,
      listVersions: unavailable,
      restoreVersion: unavailable,
    },
    generation: {
      start() {
        throw new NotImplementedError();
      },
    },
    revision: { requestRevision: unavailable },
    parser: { extractText: unavailable },
    compiler: { compile: unavailable },
    evaluation: {
      importStatisticalResults: unavailable,
      listStatisticalResults: unavailable,
      logGeneration: unavailable,
      listGenerationLogs: unavailable,
      saveExpertReview: unavailable,
      listExpertReviews: unavailable,
      saveSusResponse: unavailable,
      listSusResponses: unavailable,
      importRougeResults: unavailable,
      listRougeResults: unavailable,
    },
    examples: {
      listSamples: unavailable,
      getBlindDocuments: unavailable,
      getBlindMapping: unavailable,
    },
    auth: { getCurrentUser: unavailable },
    telemetry: { track: unavailable },
    reset: unavailable,
    loadExamples: unavailable,
    simulation: { speed: 'normal', failure: 'none' },
    calls: [],
    mode: 'live',
  };
}
