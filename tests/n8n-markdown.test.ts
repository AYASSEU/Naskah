import { describe, expect, it } from 'vitest';
import { runInNewContext } from 'node:vm';
import { buildRendererCode, rendererWorkflow } from '../n8n/build.mjs';
import { renderManuscript, ieeeTemplate } from '@naskah/core';
import { fixtureProjects, makeDocument } from '@/services/mock/fixtures';
import { ChapterDraftSchema } from '@naskah/contracts';
import { matchesSchema } from '../n8n/src/schema-validation';
import chapterSchema from '../n8n/schemas/chapter-draft.json';

describe('n8n bundled Markdown renderer', () => {
  it('agrees with the Zod contract on required fields, defaults and malformed provider output', () => {
    const chapter = {
      number: '3',
      title: 'Specific Requirements',
      sections: [
        {
          number: '3.2',
          title: 'Functional Requirements',
          body: 'Sistem harus menyimpan data.',
          requirements: [
            {
              id: 'REQ-F-01',
              title: 'Simpan',
              description: 'Simpan data tervalidasi.',
              actor: 'Penulis',
              input: 'Data',
              process: 'Validasi',
              output: 'Konfirmasi',
              priority: 'High',
            },
          ],
        },
      ],
    };
    const section = chapter.sections[0]!;
    const requirement = section.requirements[0]!;
    const variants: unknown[] = [
      chapter,
      null,
      [],
      {},
      { ...chapter, number: 3 },
      { ...chapter, number: '3\nforged' },
      { ...chapter, title: '' },
      { ...chapter, title: 'Judul\r\nbaru' },
      { ...chapter, sections: [] },
      { ...chapter, sections: [{ ...section, body: null }] },
      { ...chapter, sections: [{ ...section, requirements: undefined }] },
      { ...chapter, sections: [{ number: '3.2', title: 'Functional Requirements', body: '' }] },
      { ...chapter, sections: [{ ...section, requirements: null }] },
      {
        ...chapter,
        sections: [{ ...section, requirements: [{ ...requirement, id: 'REQ-F-secret' }] }],
      },
      {
        ...chapter,
        sections: [{ ...section, requirements: [{ ...requirement, priority: 'Critical' }] }],
      },
      { ...chapter, sections: [{ ...section, requirements: [{ ...requirement, actor: 42 }] }] },
      { ...chapter, extra: 'The Zod object strips this, rather than rejecting it.' },
    ];
    for (const value of variants) {
      // Transport is JSON: undefined properties disappear before an n8n node sees them.
      const wireValue = JSON.parse(JSON.stringify(value));
      expect(matchesSchema(wireValue, chapterSchema)).toBe(
        ChapterDraftSchema.safeParse(wireValue).success,
      );
    }
  });
  it('produces exactly the host-rendered manuscript inside an isolated Code-node scope', async () => {
    const code = await buildRendererCode();
    for (const project of fixtureProjects) {
      const document = makeDocument(project);
      const chapters = ieeeTemplate.chapters.map((chapter) => ({
        number: chapter.number,
        title: chapter.title,
        sections: chapter.subsections.map((subsection) => ({
          number: subsection.number,
          title: subsection.title,
          body: document.sections.find((s) => s.number === subsection.number)!.markdown,
          requirements: [],
        })),
      }));
      const output = runInNewContext(
        `(function(){${code}})()`,
        {
          $input: { first: () => ({ json: { body: { chapters } } }) },
        },
        { timeout: 5000 },
      ) as { json: { ok: boolean; markdown: string } }[];
      expect(output[0]!.json.ok).toBe(true);
      expect(output[0]!.json.markdown).toBe(renderManuscript(chapters));
    }
    expect(rendererWorkflow(code).settings.saveDataSuccessExecution).toBe('none');
    expect(code).not.toMatch(/require\(["'](?:fs|http|https|node:)/);
  });
  it('rejects malformed provider chapter data without returning its raw input', async () => {
    const code = await buildRendererCode();
    expect(() =>
      runInNewContext(
        `(function(){${code}})()`,
        {
          $input: { first: () => ({ json: { body: { chapters: [{ title: 'untrusted' }] } } }) },
        },
        { timeout: 5000 },
      ),
    ).toThrow('invalid_input');
  });
  it('returns plain items when the runner disables property-definition APIs', async () => {
    const code = await buildRendererCode();
    const chapters = [
      {
        number: '1',
        title: 'Introduction',
        sections: [
          {
            number: '1.1',
            title: 'Purpose',
            body: 'Synthetic development fixture.',
            requirements: [],
          },
        ],
      },
    ];
    const output = runInNewContext(
      `(function(){Object.defineProperty=()=>({});Object.defineProperties=()=>({});${code}})()`,
      { $input: { first: () => ({ json: { body: { chapters } } }) } },
      { timeout: 5000 },
    ) as { json: { ok: boolean; markdown: string } }[];
    expect(output).toEqual([{ json: { ok: true, markdown: renderManuscript(chapters) } }]);
    expect(code).not.toContain('Object.defineProperty');
  });
});
