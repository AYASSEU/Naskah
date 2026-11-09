import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ChapterDraftSchema, type Requirement } from '@naskah/contracts';
import {
  applySafeRewrite,
  checkStructure,
  ieeeTemplate,
  markRewrite,
  parseManuscript,
  parseRequirements,
  renderChapter,
  renderManuscript,
  renderParsedManuscript,
  renderRequirement,
  renderTraceability,
  requireGroundedNumbers,
  rewriteSpans,
  renderDocumentSections,
} from '@naskah/core';
import { fixtureProjects, makeDocument } from '@/services/mock/fixtures';

const requirement: Requirement = {
  id: 'REQ-F-01',
  title: 'Pendaftaran *pasien*',
  description: 'Sistem harus menyimpan data tervalidasi.',
  actor: 'Petugas',
  input: 'NIK\nNama lengkap',
  process: 'Validasi dan penyimpanan',
  output: 'Nomor rekam medis',
  priority: 'Medium',
};

describe('shared Markdown contract', () => {
  it('preserves all Phase 1 manuscripts byte for byte, including tables and use cases', () => {
    for (const [index, project] of fixtureProjects.entries()) {
      const golden = readFileSync(
        resolve(`tests/fixtures/markdown/phase1-${index + 1}.md`),
        'utf8',
      );
      const document = makeDocument(project);
      const parsed = parseManuscript(golden);
      expect(renderParsedManuscript(parsed)).toBe(golden);
      expect(renderDocumentSections(document.sections)).toBe(golden);
      expect(parsed.sections.filter((s) => s.level === 2)).toHaveLength(document.sections.length);
      const functional = parsed.sections.find((s) => s.number === '3.2')!;
      expect(parseRequirements(functional.body)).toEqual(
        document.sections.find((s) => s.number === '3.2')!.requirements,
      );
      if (project.status !== 'failed')
        expect(parsed.sections.find((s) => s.number === '4.2')!.body).toContain('| Kebutuhan |');
    }
  });

  it('preserves CRLF, preambles and code fences that contain fake headings or requirements', () => {
    const text =
      'Sampul\r\n\r\n# 1. Introduction\r\n\r\n## 1.1 Purpose\r\n\r\n```md\r\n## 9.9 Bukan bagian\r\n**REQ-F-99 — Bukan kebutuhan**\r\n```\r\n';
    const parsed = parseManuscript(text);
    expect(parsed.sections.map((s) => s.number)).toEqual(['1', '1.1']);
    expect(parseRequirements(text)).toEqual([]);
    expect(renderParsedManuscript(parsed)).toBe(text);
    parsed.sections[1]!.body += '\r\nCatatan baru.\r\n';
    expect(renderParsedManuscript(parsed)).toBe(text + '\r\nCatatan baru.\r\n');
  });

  it('round-trips structured requirement fields without synthesizing missing information', () => {
    expect(parseRequirements(renderRequirement(requirement))).toEqual([requirement]);
    expect(parseRequirements(renderRequirement(requirement).replaceAll('\n', '\r\n'))).toEqual([
      requirement,
    ]);
    const legacy = parseRequirements('**REQ-F-02 — Judul**\nDeskripsi.')[0]!;
    expect(legacy.actor).toBe('');
    expect(legacy.input).toBe('');
    expect(legacy.description).toBe('Deskripsi.');
  });

  it('reads the compact Phase 1 actor, priority and process fields accurately', () => {
    const input =
      '**REQ-F-03 — Simpan**\nDeskripsi.\n\nPrioritas: [Low]\n\nAktor: Dokter · Input: resep · Proses: verifikasi · Output: konfirmasi.';
    expect(parseRequirements(input)).toEqual([
      {
        id: 'REQ-F-03',
        title: 'Simpan',
        description: 'Deskripsi.',
        priority: 'Low',
        actor: 'Dokter',
        input: 'resep',
        process: 'verifikasi',
        output: 'konfirmasi.',
      },
    ]);
  });

  it('renders schema-validated chapter data deterministically with LF and one final newline', () => {
    const chapter = ChapterDraftSchema.parse({
      number: '3',
      title: 'Specific Requirements',
      sections: [
        {
          number: '3.2',
          title: 'Functional Requirements',
          body: 'Pengantar.\r\n',
          requirements: [requirement],
        },
      ],
    });
    const output = renderChapter(chapter);
    expect(output).toBe(
      '# 3. Specific Requirements\n\n## 3.2 Functional Requirements\n\nPengantar.\n\n' +
        renderRequirement(requirement) +
        '\n',
    );
    expect(renderManuscript([chapter])).toBe(output);
    expect(parseRequirements(output)).toEqual([requirement]);
    expect(ChapterDraftSchema.safeParse({ ...chapter, number: '3\n# forged' }).success).toBe(false);
    expect(() => renderManuscript([chapter, chapter])).toThrow('markdown_duplicate_chapter');
    expect(() =>
      renderChapter({ ...chapter, sections: [...chapter.sections, ...chapter.sections] }),
    ).toThrow('markdown_duplicate_section');
  });

  it('rejects invalid heading hierarchy and ignores fenced headings in completeness scoring', () => {
    expect(() => parseManuscript('## 1. Introduction\n')).toThrow('markdown_heading_level');
    expect(() => parseManuscript('## 1.1 A\n## 1.1 B\n')).toThrow('markdown_duplicate_section');
    const headings = ieeeTemplate.chapters
      .map(
        (c) =>
          `# ${c.number}. ${c.title}\n${c.subsections.map((s) => `## ${s.number} ${s.title}`).join('\n')}`,
      )
      .join('\n');
    expect(checkStructure(headings).percentage).toBe(100);
    expect(checkStructure('```md\n' + headings + '\n```').percentage).toBe(0);
  });

  it('keeps rewrite markers and escaped traceability cells stable', () => {
    const marked = markRewrite('rewrite-1', 'Sistem harus cepat.');
    expect(rewriteSpans(marked)).toEqual([
      { id: 'rewrite-1', text: 'Sistem harus cepat.', offset: 0 },
    ]);
    expect(() => markRewrite('--> injected', 'x')).toThrow('markdown_invalid_rewrite_id');
    expect(
      renderTraceability([
        { requirementId: 'REQ-F-01', useCase: 'A | B', verification: 'Satu\nDua' },
      ]),
    ).toContain('| REQ-F-01 | A \\| B | Satu<br>Dua |');
  });
});

describe('deterministic guardrail rules', () => {
  const rewrite = {
    id: 'r1',
    original: 'Sistem harus cepat',
    rewritten: 'Respons dalam 2 detik untuk 500 pengguna.',
    reason: 'Terukur',
    resolved: false,
  };
  it('requires confirmation for unsupported numeric claims even if the model clears the flag', () => {
    expect(
      requireGroundedNumbers(
        [{ ...rewrite, needs_confirmation: false }],
        'Terdapat 5 pengguna.',
      )[0]!.needs_confirmation,
    ).toBe(true);
    expect(
      requireGroundedNumbers([rewrite], 'Batas 2 detik dan 500 pengguna.')[0]!.needs_confirmation,
    ).toBe(false);
    expect(
      requireGroundedNumbers(
        [{ ...rewrite, needs_confirmation: true }],
        '2 detik, 500 pengguna.',
      )[0]!.needs_confirmation,
    ).toBe(true);
  });
  it('does not treat numeric requirement identifiers as grounded measurements', () => {
    expect(
      requireGroundedNumbers([{ ...rewrite, rewritten: 'Respons 1 detik.' }], 'REQ-F-01')[0]!
        .needs_confirmation,
    ).toBe(true);
  });
  it('changes exactly one literal span and protects IDs', () => {
    expect(applySafeRewrite('Sistem cepat. Data tetap.', 'cepat', '$& aman')).toBe(
      'Sistem $& aman. Data tetap.',
    );
    expect(() => applySafeRewrite('cepat dan cepat', 'cepat', 'terukur')).toThrow(
      'guardrail_ambiguous_span',
    );
    expect(() => applySafeRewrite('REQ-F-01', 'REQ-F-01', 'REQ-F-02')).toThrow(
      'guardrail_requirement_id_changed',
    );
  });
});
