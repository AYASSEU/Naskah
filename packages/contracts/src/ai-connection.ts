import { z } from 'zod';

export const AiConnectionConfigSchema = z.object({
  provider: z.enum(['deepseek', 'custom']),
  model: z.string().trim().min(1).max(128).regex(/^\S+$/),
  baseUrl: z.url().refine((value) => {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash;
  }),
});
export type AiConnectionConfig = z.infer<typeof AiConnectionConfigSchema>;

// A write-only field. Never include this request in logs or persist it in the browser.
export const AiConnectionSaveSchema = AiConnectionConfigSchema.extend({
  apiKey: z.string().min(8).max(512).regex(/^\S+$/).optional(),
});
export type AiConnectionSave = z.infer<typeof AiConnectionSaveSchema>;

export const AiConnectionSnapshotSchema = AiConnectionConfigSchema.extend({
  hasApiKey: z.boolean(),
  credentialStorage: z.enum(['memory', 'server']),
});
export type AiConnectionSnapshot = z.infer<typeof AiConnectionSnapshotSchema>;

export const AiConnectionTestSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('mock'),
    status: z.literal('simulated'),
    checkedAt: z.iso.datetime(),
  }),
  z.object({
    mode: z.literal('live'),
    status: z.literal('connected'),
    checkedAt: z.iso.datetime(),
  }),
]);
export type AiConnectionTest = z.infer<typeof AiConnectionTestSchema>;

export const defaultAiConnection: AiConnectionConfig = {
  provider: 'deepseek',
  model: 'deepseek-chat',
  baseUrl: 'https://api.deepseek.com',
};
