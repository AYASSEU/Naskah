import type { ChapterDraft, Requirement, Section, SrsTemplate } from '@naskah/contracts';
import { ieeeTemplate } from './template';

export interface MarkdownSection {
  level: 1 | 2;
  number: string;
  title: string;
  /** Original heading, including its original line ending. */
  heading: string;
  /** Original body, including separating whitespace. */
  body: string;
}
export interface ParsedManuscript {
  preamble: string;
  sections: MarkdownSection[];
}

function linesOutsideFences(text: string) {
  const result: { text: string; raw: string; offset: number; fenced: boolean }[] = [];
  let fence: { char: string; length: number } | undefined;
  for (const match of text.matchAll(/[^\r\n]*(?:\r\n|\n|\r|$)/g)) {
    if (!match[0]) continue;
    const raw = match[0];
    const line = raw.replace(/[\r\n]+$/, '');
    const delimiter = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    const wasFenced = !!fence;
    if (delimiter) {
      const token = delimiter[1]!;
      if (!fence) fence = { char: token[0]!, length: token.length };
      else if (token[0] === fence.char && token.length >= fence.length && !delimiter[2]!.trim())
        fence = undefined;
    }
    result.push({ text: line, raw, offset: match.index!, fenced: wasFenced || !!delimiter });
  }
  return result;
}

function oneLine(value: string) {
  if (/[\r\n]/.test(value)) throw new Error('markdown_inline_newline');
  return value;
}
const inline = (value: string) => oneLine(value).replace(/([\\*])/g, '\\$1');
const uninline = (value: string) => value.replace(/\\([\\*])/g, '$1');
const normalized = (value: string) => value.replace(/\r\n?/g, '\n').replace(/^\n+|\n+$/g, '');

/** Lossless parsing: ordinary prose, tables, code and line endings stay intact. */
export function parseManuscript(markdown: string): ParsedManuscript {
  const headings = linesOutsideFences(markdown).flatMap((line) => {
    if (line.fenced) return [];
    const match = /^(#{1,2})[ \t]+(\d+(?:\.\d+)*)(?:\.)?[ \t]+(.+?)[ \t]*$/.exec(line.text);
    if (!match) return [];
    const level = match[1]!.length as 1 | 2;
    const number = match[2]!;
    if ((level === 1) !== !number.includes('.')) throw new Error('markdown_heading_level');
    return [{ level, number, title: match[3]!, heading: line.raw, offset: line.offset }];
  });
  const seen = new Set<string>();
  for (const h of headings) {
    if (seen.has(h.number)) throw new Error('markdown_duplicate_section');
    seen.add(h.number);
  }
  return {
    preamble: markdown.slice(0, headings[0]?.offset ?? markdown.length),
    sections: headings.map((h, i) => ({
      level: h.level,
      number: h.number,
      title: h.title,
      heading: h.heading,
      body: markdown.slice(h.offset + h.heading.length, headings[i + 1]?.offset ?? markdown.length),
    })),
  };
}

export function renderParsedManuscript(document: ParsedManuscript): string {
  return document.preamble + document.sections.map((s) => s.heading + s.body).join('');
}

const fieldLabels = ['Aktor', 'Input', 'Proses', 'Output'] as const;
export function renderRequirement(requirement: Requirement): string {
  if (!/^REQ-[A-Z]-\d+$/.test(requirement.id)) throw new Error('markdown_invalid_requirement_id');
  const values = [requirement.actor, requirement.input, requirement.process, requirement.output];
  const fields = fieldLabels.map(
    (label, i) => `${label}: ${normalized(values[i]!).replaceAll('\n', '\n  ')}`,
  );
  return `**${requirement.id} — ${inline(requirement.title)}**\n${normalized(requirement.description)}\n\nPrioritas: [${requirement.priority}]\n\n${fields.join('\n')}`;
}

function requirementFromBlock(id: string, title: string, body: string): Requirement {
  // Field parsing is independent of source line endings; lossless parsing retains them.
  body = body.replace(/\r\n?/g, '\n');
  const priority = /^Prioritas:[ \t]*\[(High|Medium|Low)\][ \t]*$/m.exec(body);
  const firstField = /^(?:Aktor|Actor|Input|Proses|Process|Output):[ \t]*/m.exec(body);
  const descriptionEnd = Math.min(priority?.index ?? body.length, firstField?.index ?? body.length);
  const fields: Record<string, string> = {};
  const fieldText = body
    .slice(firstField?.index ?? body.length)
    .replace(/[ \t]+·[ \t]+(?=(?:Input|Proses|Process|Output):)/g, '\n');
  for (const match of fieldText.matchAll(
    /^(Aktor|Actor|Input|Proses|Process|Output):[ \t]*(.*(?:\n {2}[^\n]*)*)/gm,
  ))
    fields[match[1]!] = match[2]!.replace(/\n {2}/g, '\n').trimEnd();
  return {
    id,
    title: uninline(title),
    description: body.slice(0, descriptionEnd).trim(),
    actor: fields.Aktor ?? fields.Actor ?? '',
    input: fields.Input ?? '',
    process: fields.Proses ?? fields.Process ?? '',
    output: fields.Output ?? '',
    priority: (priority?.[1] as Requirement['priority'] | undefined) ?? 'High',
  };
}

/** Reads both canonical blocks and Phase 1's compact metadata; never invents actors. */
export function parseRequirements(markdown: string): Requirement[] {
  const lines = linesOutsideFences(markdown);
  const result: Requirement[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.fenced) continue;
    const header = /^\*\*(REQ-[A-Z]-\d+)[ \t]*[—:-][ \t]*(.+?)\*\*[ \t]*$/.exec(line.text);
    if (!header) continue;
    const start = line.offset + line.raw.length;
    let end = markdown.length;
    for (let j = i + 1; j < lines.length; j++) {
      const next = lines[j]!;
      if (
        !next.fenced &&
        (/^\*\*REQ-[A-Z]-\d+[ \t]*[—:-]/.test(next.text) || /^#{1,6}\s/.test(next.text))
      ) {
        end = next.offset;
        break;
      }
    }
    result.push(requirementFromBlock(header[1]!, header[2]!, markdown.slice(start, end)));
  }
  return result;
}

export function duplicateIds(markdown: string): string[] {
  const text = linesOutsideFences(markdown)
    .filter((line) => !line.fenced)
    .map((line) => line.text)
    .join('\n');
  const ids = [...text.matchAll(/\bREQ-[A-Z]-\d+\b/g)].map((m) => m[0]);
  return [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
}
export function nextId(markdown: string): string {
  const ids = [...markdown.matchAll(/REQ-F-(\d+)/g)].map((m) => Number(m[1]));
  return `REQ-F-${String(Math.max(0, ...ids) + 1).padStart(2, '0')}`;
}

export function renderChapter(chapter: ChapterDraft): string {
  if (!/^\d+$/.test(chapter.number)) throw new Error('markdown_invalid_chapter_number');
  const sections = chapter.sections.map((section) => {
    if (!new RegExp(`^${chapter.number}\\.\\d+$`).test(section.number))
      throw new Error('markdown_invalid_section_number');
    const content = [normalized(section.body), ...section.requirements.map(renderRequirement)]
      .filter(Boolean)
      .join('\n\n');
    return `## ${section.number} ${oneLine(section.title)}\n\n${content}`;
  });
  if (new Set(chapter.sections.map((s) => s.number)).size !== chapter.sections.length)
    throw new Error('markdown_duplicate_section');
  const ids = chapter.sections.flatMap((s) => s.requirements.map((r) => r.id));
  if (new Set(ids).size !== ids.length) throw new Error('markdown_duplicate_requirement');
  return `# ${chapter.number}. ${oneLine(chapter.title)}\n\n${sections.join('\n\n')}\n`;
}
export function renderManuscript(chapters: ChapterDraft[]): string {
  if (new Set(chapters.map((c) => c.number)).size !== chapters.length)
    throw new Error('markdown_duplicate_chapter');
  const ids = chapters.flatMap((c) => c.sections.flatMap((s) => s.requirements.map((r) => r.id)));
  if (new Set(ids).size !== ids.length) throw new Error('markdown_duplicate_requirement');
  return chapters.map(renderChapter).join('\n');
}

/** Assembles existing editor sections without regenerating their requirement prose. */
export function renderDocumentSections(
  sections: Pick<Section, 'number' | 'title' | 'markdown'>[],
  template: SrsTemplate = ieeeTemplate,
): string {
  return renderManuscript(
    template.chapters.map((chapter) => ({
      number: chapter.number,
      title: chapter.title,
      sections: chapter.subsections.map((subsection) => {
        const section = sections.find((candidate) => candidate.number === subsection.number);
        return {
          number: subsection.number,
          title: section?.title ?? subsection.title,
          body: section?.markdown ?? '',
          requirements: [],
        };
      }),
    })),
  );
}

export interface TraceabilityRow {
  requirementId: string;
  useCase: string;
  verification: string;
}
const tableCell = (text: string) =>
  text.replaceAll('\\', '\\\\').replaceAll('|', '\\|').replace(/\r?\n/g, '<br>');
export function renderTraceability(rows: TraceabilityRow[]): string {
  return [
    '| Kebutuhan | Use case | Metode verifikasi |',
    '| --- | --- | --- |',
    ...rows.map(
      (r) =>
        `| ${tableCell(r.requirementId)} | ${tableCell(r.useCase)} | ${tableCell(r.verification)} |`,
    ),
  ].join('\n');
}

export function markRewrite(id: string, text: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new Error('markdown_invalid_rewrite_id');
  return `<!-- naskah:rewrite:${id}:start -->${text}<!-- naskah:rewrite:${id}:end -->`;
}
export function rewriteSpans(markdown: string) {
  return [
    ...markdown.matchAll(
      /<!-- naskah:rewrite:([A-Za-z0-9_-]+):start -->([\s\S]*?)<!-- naskah:rewrite:\1:end -->/g,
    ),
  ].map((m) => ({ id: m[1]!, text: m[2]!, offset: m.index! }));
}
