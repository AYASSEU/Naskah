import type { SrsTemplate } from '@naskah/contracts';
import { ieeeTemplate } from './template';
import { parseManuscript } from './markdown';

export function checkStructure(markdown: string, template: SrsTemplate = ieeeTemplate) {
  const expected = template.chapters.flatMap((c) => [
    { number: c.number, title: c.title },
    ...c.subsections.filter((s) => s.required),
  ]);
  const found = new Set(parseManuscript(markdown).sections.map((s) => s.number));
  const missing = expected.filter((heading) => !found.has(heading.number));
  return {
    percentage: expected.length
      ? Math.round(((expected.length - missing.length) / expected.length) * 100)
      : 0,
    missing,
  };
}
