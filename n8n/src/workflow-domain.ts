import type {
  ChapterDraft,
  GuardrailReport,
  Requirement,
  Section,
  SrsTemplate,
} from '../../packages/contracts/src/index';
import {
  applySafeRewrite,
  parseManuscript,
  parseRequirements,
  renderChapter,
  requireGroundedNumbers,
} from '../../packages/core/src/index';
import chapterSchema from '../schemas/chapter-draft.json';
import { matchesSchema } from './schema-validation';

export const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
export function modelJson(value: unknown): unknown {
  const text = record(record((record(value).choices as unknown[])?.[0]).message).content;
  if (typeof text !== 'string' || text.length > 1024 * 1024 || !text.trim())
    throw new Error('llm_invalid_output');
  const unwrapped = text.trim().replace(/^```(?:json)?\s*\n([\s\S]*?)\n```$/i, '$1');
  try {
    return JSON.parse(unwrapped);
  } catch {
    throw new Error('llm_invalid_output');
  }
}
export function validateChapter(
  value: unknown,
  target: SrsTemplate['chapters'][number],
  usedIds: string[] = [],
): ChapterDraft {
  if (!matchesSchema(value, chapterSchema)) throw new Error('llm_invalid_output');
  const chapter = JSON.parse(JSON.stringify(value)) as ChapterDraft;
  chapter.sections.forEach((s) => (s.requirements ??= []));
  if (
    chapter.number !== target.number ||
    chapter.title !== target.title ||
    chapter.sections.length !== target.subsections.length ||
    chapter.sections.some(
      (s, i) =>
        s.number !== target.subsections[i]?.number || s.title !== target.subsections[i]?.title,
    )
  )
    throw new Error('llm_invalid_output');
  const ids = chapter.sections.flatMap((s) => s.requirements.map((r) => r.id));
  if (new Set([...usedIds, ...ids]).size !== usedIds.length + ids.length)
    throw new Error('llm_invalid_output');
  const rendered = renderChapter(chapter);
  const headings = parseManuscript(rendered).sections.map((s) => s.number);
  if (
    JSON.stringify(headings) !==
    JSON.stringify([target.number, ...target.subsections.map((s) => s.number)])
  )
    throw new Error('llm_invalid_output');
  return chapter;
}
const lexicon = [
  'cepat',
  'mudah',
  'fleksibel',
  'efisien',
  'optimal',
  'andal',
  'user-friendly',
  'dan lain-lain',
  'fast',
  'easy',
  'flexible',
  'efficient',
  'etc.',
];
export function ambiguities(chapter: ChapterDraft) {
  const text = chapter.sections
    .flatMap((s) => [s.body, ...s.requirements.map((r) => r.description)])
    .join('\n');
  return lexicon.filter((term) =>
    new RegExp(
      `(?:^|[^\\p{L}])${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=$|[^\\p{L}])`,
      'iu',
    ).test(text),
  );
}
export function reflectChapter(
  original: ChapterDraft,
  value: unknown,
  evidence: string,
  target: SrsTemplate['chapters'][number],
  usedIds: string[] = [],
  allowedSpans?: string[],
) {
  const input = record(value);
  const names = ['unambiguous', 'complete', 'correct', 'verifiable'] as const;
  if (
    !Array.isArray(input.dimensions) ||
    input.dimensions.length !== 4 ||
    !Array.isArray(input.rewrites) ||
    input.rewrites.length > 100
  )
    throw new Error('guardrail_failed');
  const dimensions = names.map((name) => {
    const dimension = (input.dimensions as unknown[]).find((d: unknown) => record(d).name === name);
    const d = record(dimension);
    if (
      typeof d.reason !== 'string' ||
      (typeof d.passed !== 'boolean' && !['pass', 'warn', 'fail'].includes(String(d.verdict)))
    )
      throw new Error('guardrail_failed');
    return {
      name,
      passed: d.verdict ? d.verdict === 'pass' : d.passed === true,
      reason: d.reason.slice(0, 2000),
    };
  });
  const rewrites = (input.rewrites as unknown[]).map((item, i) => {
    const r = record(item);
    if (
      typeof r.original !== 'string' ||
      typeof r.rewritten !== 'string' ||
      typeof r.reason !== 'string'
    )
      throw new Error('guardrail_failed');
    return {
      id: `rewrite-${i + 1}`,
      original: r.original,
      rewritten: r.rewritten,
      reason: r.reason,
      resolved: false,
      needs_confirmation: r.needs_confirmation === true,
    };
  });
  const chapter = JSON.parse(JSON.stringify(original)) as ChapterDraft;
  const fields = chapter.sections.flatMap((section) => [
    {
      get: () => section.body,
      set: (value: string) => {
        section.body = value;
      },
    },
    ...section.requirements.flatMap((requirement) =>
      (['title', 'description', 'actor', 'input', 'process', 'output'] as const).map((key) => ({
        get: () => requirement[key],
        set: (value: string) => {
          requirement[key] = value;
        },
      })),
    ),
  ]);
  const applied: GuardrailReport['rewrites'] = [];
  let ignored = 0;
  for (const rewrite of requireGroundedNumbers(rewrites, evidence)) {
    const matching = fields.filter(
      (field) => rewrite.original && field.get().includes(rewrite.original),
    );
    if (
      !rewrite.rewritten.trim() ||
      matching.length !== 1 ||
      (allowedSpans && !allowedSpans.some((span) => span.includes(rewrite.original)))
    ) {
      ignored++;
      continue;
    }
    const field = matching[0]!,
      before = field.get();
    try {
      field.set(applySafeRewrite(before, rewrite.original, rewrite.rewritten));
      validateChapter(chapter, target, usedIds);
      applied.push(rewrite);
    } catch {
      field.set(before);
      ignored++;
    }
  }
  // The model's corrected object is advisory. Only validated literal rewrites
  // above can alter the draft; it cannot silently add/remove requirements.
  const remaining = ambiguities(chapter);
  if (remaining.length) {
    dimensions[0]!.passed = false;
    dimensions[0]!.reason = `Ambiguous terms remain: ${remaining.join(', ')}`;
  }
  return { chapter, report: { dimensions, rewrites: applied }, ignored, ambiguities: remaining };
}
export function chapterSections(
  chapter: ChapterDraft,
  report: GuardrailReport,
  now: string,
): Section[] {
  const parsed = parseManuscript(renderChapter(chapter));
  return chapter.sections.map((section) => {
    const markdown = parsed.sections
      .find((s) => s.number === section.number)!
      .body.replace(/^\n+|\n+$/g, '');
    return {
      id: section.number,
      number: section.number,
      title: section.title,
      markdown,
      status: 'drafted',
      source: 'ai',
      requirements: parseRequirements(markdown),
      guardrail: {
        dimensions: report.dimensions,
        rewrites: report.rewrites.filter((r) => markdown.includes(r.rewritten)),
      },
      updatedAt: now,
      version: 1,
      locked: false,
    };
  });
}
export function validateRevision(before: string, after: unknown, reserved: string[] = []): string {
  if (typeof after !== 'string' || !after.trim() || after.length > 400000)
    throw new Error('llm_invalid_output');
  const old = parseRequirements(before).map((r) => r.id),
    updated = parseRequirements(after).map((r) => r.id);
  if (
    new Set(updated).size !== updated.length ||
    old.some((id) => !updated.includes(id)) ||
    updated.some((id) => reserved.includes(id))
  )
    throw new Error('llm_invalid_output');
  const headings = (text: string) =>
    parseManuscript(text).sections.map((s) => `${s.level}:${s.number}`);
  if (JSON.stringify(headings(before)) !== JSON.stringify(headings(after)))
    throw new Error('llm_invalid_output');
  return after;
}
export function retrievalQuery(
  title: string,
  domain: string,
  text: string,
  inputLimit: number,
): string {
  const sentences = text.split(/(?<=[.!?])\s+|\n+/).map((text, index) => ({
    text,
    index,
    score: (text.match(/\b(?:harus|wajib|shall|must|require|aktor|input|output|sistem)\b/gi) ?? [])
      .length,
  }));
  const dense = sentences
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, 24)
    .map((s) => s.text)
    .join(' ');
  return `${title}\n${domain}\n${dense}`.slice(0, Math.max(1, inputLimit) * 4);
}
export function retryDelay(
  headers: Record<string, unknown>,
  attempt: number,
  now: number,
): number | null {
  const raw = headers['retry-after'] ?? headers['Retry-After'];
  let required = 0;
  if (raw !== undefined) {
    const seconds = Number(raw);
    required = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(String(raw)) - now;
  }
  if (required > 300000) return null; // Stop rather than retry before the provider permits it.
  return Math.max(1000 * 2 ** Math.max(0, attempt - 1), Number.isFinite(required) ? required : 0);
}
export function taskMessage(task: Record<string, unknown>) {
  // Escape delimiters inside user/retrieval strings; these remain JSON data.
  return `<task_json>${JSON.stringify(task).replaceAll('<', '\\u003c').replaceAll('>', '\\u003e')}</task_json>`;
}
export function requirementIds(sections: Section[]): string[] {
  return sections.flatMap((s) => s.requirements.map((r: Requirement) => r.id));
}
