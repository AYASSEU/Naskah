import type { ChapterDraft } from '../../packages/contracts/src/index';
import { renderManuscript } from '../../packages/core/src/index';
import schema from '../schemas/chapter-draft.json';
import { matchesSchema } from './schema-validation';

declare const $input: { first(): { json: { body?: unknown } } };
declare const __naskahResult: { items: { json: { ok: boolean; markdown: string } }[] };

const body = $input.first().json.body;
const raw = body && typeof body === 'object' && 'chapters' in body ? body.chapters : undefined;
if (
  !Array.isArray(raw) ||
  raw.length < 1 ||
  raw.length > 16 ||
  !raw.every((chapter) => matchesSchema(chapter, schema))
)
  throw new Error('invalid_input');
const chapters = (raw as ChapterDraft[]).map((chapter) => ({
  number: chapter.number,
  title: chapter.title,
  sections: chapter.sections.map((section) => ({
    number: section.number,
    title: section.title,
    body: section.body,
    requirements: section.requirements ?? [],
  })),
}));
const markdown = renderManuscript(chapters);
// n8n disables Object.defineProperty, so esbuild's module-export getters cannot be
// used to return data. The builder supplies this plain local result container.
__naskahResult.items = [{ json: { ok: true, markdown } }];
