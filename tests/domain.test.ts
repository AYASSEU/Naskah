import { describe, it, expect } from 'vitest';
import {
  DocumentSchema,
  ProjectSchema,
  GenerationLogSchema,
  TemplateSchema,
  ChapterOutputSchema,
  GenerateInputSchema,
  ReviseInputSchema,
} from '@naskah/contracts';
import { fixtureProjects, fixtureLogs, makeDocument } from '@/services/mock/fixtures';
import { cleanPages, mergeSources } from '@/entities/document/cleaning';
import { parseRequirements, nextId, duplicateIds } from '@/entities/requirement/parsing';
import { scoreSus, statistics } from '@/entities/evaluation/sus';
import { checkStructure } from '@/entities/evaluation/structure';
import { ieeeTemplate } from '@/entities/template/ieee';
import { applyRevision } from '@/entities/revision/apply';
import { buildGenerateRequest, buildRevisionRequest } from '@/services/http';
import { parseRougeImport, csvRecords } from '@/entities/evaluation/rouge';
describe('shared contracts', () => {
  it('validates all three fixtures, every section, and every generation log', () => {
    for (const p of fixtureProjects) {
      expect(ProjectSchema.safeParse(p).success).toBe(true);
      expect(DocumentSchema.safeParse(makeDocument(p)).success).toBe(true);
    }
    fixtureLogs.forEach((log) => expect(GenerationLogSchema.safeParse(log).success).toBe(true));
    expect(TemplateSchema.safeParse(ieeeTemplate).success).toBe(true);
  });
  it('matches the chapter 3 JSON contract', () => {
    const doc = makeDocument(fixtureProjects[0]!);
    expect(
      ChapterOutputSchema.safeParse({
        section_title: 'Specific Requirements',
        external_interfaces: 'HTTPS',
        functional_requirements: doc.sections.find((s) => s.id === '3.2')!.requirements,
        performance_requirements: '2 s / 500 sessions',
        security_requirements: 'AES-256',
      }).success,
    ).toBe(true);
  });
  it('validates HTTP request builders against the exact webhook payloads', () => {
    const p = fixtureProjects[0]!;
    expect(
      GenerateInputSchema.parse(
        buildGenerateRequest({
          session_id: p.sessionId,
          project_title: p.title,
          domain: p.domain,
          raw_text: p.rawText,
        }),
      ).session_id,
    ).toBe(p.sessionId);
    expect(
      ReviseInputSchema.parse(
        buildRevisionRequest({
          session_id: p.sessionId,
          target_section: '3.2 Functional Requirements',
          current_section_text: 'Sistem harus…',
          user_instructions: 'Tambahkan QRIS',
        }),
      ).target_section,
    ).toBe('3.2 Functional Requirements');
  });
  it('rejects invalid UUIDs and empty context', () => {
    expect(
      GenerateInputSchema.safeParse({
        session_id: 'invalid',
        project_title: 'Test',
        domain: 'Healthcare',
        raw_text: '',
      }).success,
    ).toBe(false);
  });
});
describe('input cleaning', () => {
  it('rejoins hard wraps and strips control and replacement characters', () => {
    expect(cleanPages(['Sistem harus\nmenyimpan data.\n\nParagraf kedua.\u0000\uFFFD']).text).toBe(
      'Sistem harus menyimpan data.\n\nParagraf kedua.',
    );
  });
  it('removes repeated headers, footers, and page numbers', () => {
    const result = cleanPages([
      'Rumah sakit\nIsi satu\n1',
      'Rumah sakit\nIsi dua\n2',
      'Rumah sakit\nIsi tiga\n3',
    ]);
    expect(result.text).not.toContain('Rumah sakit');
    expect(result.removed).toBe(6);
    expect(result.text).toContain('Isi dua');
  });
  it('does not delete repeated content when there is only one page', () => {
    expect(cleanPages(['Kebutuhan\nKebutuhan']).text).toBe('Kebutuhan Kebutuhan');
  });
  it('merges descriptions and files with source delimiters', () => {
    expect(mergeSources(' Catatan ', [{ name: 'rapat.txt', text: 'Tujuh aktor.' }])).toContain(
      '--- Sumber: rapat.txt ---\nTujuh aktor.',
    );
  });
});
describe('requirement parsing', () => {
  it('parses 39 unique hospital functional requirements', () => {
    const section = makeDocument(fixtureProjects[0]!).sections.find((s) => s.id === '3.2')!;
    expect(parseRequirements(section.markdown)).toHaveLength(39);
    expect(duplicateIds(section.markdown)).toEqual([]);
    expect(nextId(section.markdown)).toBe('REQ-F-40');
  });
  it('finds duplicate IDs and skips occupied numbers', () => {
    expect(duplicateIds('REQ-F-01 REQ-F-02 REQ-F-01')).toEqual(['REQ-F-01']);
    expect(nextId('REQ-F-03 REQ-F-12')).toBe('REQ-F-13');
    expect(nextId('')).toBe('REQ-F-01');
  });
});
describe('evaluation calculations', () => {
  it('imports quoted CSV and validates metric bounds', () => {
    expect(csvRecords('scenario,note\r\n"Sistem, kampus","Kata ""uji"""')[0]).toEqual({
      scenario: 'Sistem, kampus',
      note: 'Kata "uji"',
    });
    const csv =
      'scenario,rouge1.precision,rouge1.recall,rouge1.f1,rouge2.precision,rouge2.recall,rouge2.f1,rougeL.precision,rougeL.recall,rougeL.f1\nSistem,0.8,0.7,0.75,0.5,0.4,0.45,0.6,0.5,0.55';
    expect(parseRougeImport(csv, 'csv')[0]!.rouge1.f1).toBe(0.75);
    expect(() => parseRougeImport('[{"scenario":"bad"}]', 'json')).toThrow();
  });
  it('scores a worked 80 point SUS response', () => {
    expect(scoreSus([4, 2, 4, 2, 4, 1, 5, 2, 4, 2])).toBe(80);
  });
  it('preserves odd/even polarity and edge cases', () => {
    expect(scoreSus(Array(10).fill(1))).toBe(50);
    expect(scoreSus(Array(10).fill(5))).toBe(50);
    expect(scoreSus([5, 1, 5, 1, 5, 1, 5, 1, 5, 1])).toBe(100);
    expect(scoreSus([1, 5, 1, 5, 1, 5, 1, 5, 1, 5])).toBe(0);
    expect(() => scoreSus([5])).toThrow();
    expect(() => scoreSus(Array(10).fill(6))).toThrow();
  });
  it('calculates 100% for all required headings, and reports omissions', () => {
    const text = ieeeTemplate.chapters
      .map(
        (c) =>
          `# ${c.number}. ${c.title}\n${c.subsections.map((s) => `## ${s.number} ${s.title}`).join('\n')}`,
      )
      .join('\n');
    expect(checkStructure(text).percentage).toBe(100);
    const partial = checkStructure(text.replace('## 1.3 Glossary (Glosarium)', ''));
    expect(partial.missing[0]!.number).toBe('1.3');
    expect(partial.percentage).toBe(95);
    expect(checkStructure('').percentage).toBe(0);
  });
  it('computes mean, median and sample standard deviation', () => {
    expect(statistics([1, 2, 3])).toEqual({ mean: 2, median: 2, sd: 1 });
    expect(statistics([])).toEqual({ mean: 0, median: 0, sd: 0 });
  });
});
describe('human-in-the-loop revision isolation', () => {
  it('accepts only the target and leaves every other markdown byte-identical', () => {
    const doc = makeDocument(fixtureProjects[0]!);
    const target = doc.sections.find((s) => s.id === '3.4')!;
    const before = structuredClone(doc.sections);
    const after = applyRevision(before, {
      id: crypto.randomUUID(),
      sectionId: target.id,
      instruction: '2FA',
      before: target.markdown,
      after: target.markdown + '\n2FA wajib.',
      retrievalQuery: '2FA',
      status: 'pending',
    });
    for (const section of before) {
      const result = after.find((s) => s.id === section.id)!;
      if (section.id !== target.id) expect(result.markdown).toBe(section.markdown);
      else {
        expect(result.markdown).toContain('2FA wajib.');
        expect(result.status).toBe('revised');
      }
    }
    expect(doc.sections.find((s) => s.id === target.id)!.markdown).toBe(target.markdown);
  });
  it('blocks changes to a locked section and detects stale proposals', () => {
    const doc = makeDocument(fixtureProjects[0]!);
    const s = doc.sections[0]!;
    const proposal = {
      id: crypto.randomUUID(),
      sectionId: s.id,
      instruction: 'test',
      before: s.markdown,
      after: 'new',
      retrievalQuery: 'test',
      status: 'pending' as const,
    };
    expect(() => applyRevision([{ ...s, status: 'locked' }], proposal)).toThrow('locked');
    expect(() => applyRevision([{ ...s, markdown: 'concurrent edit' }], proposal)).toThrow(
      'changed',
    );
  });
});
