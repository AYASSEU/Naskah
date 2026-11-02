import type { DocumentRepository, ProjectRepository, CompilerService } from '../ports';
export function createCompiler(
  documents: DocumentRepository,
  projects: ProjectRepository,
): CompilerService {
  return {
    async compile(id, format) {
      const p = await projects.get(id);
      if (format === 'pdf')
        return { url: `/export/${id}/print`, filename: `${p.title}.pdf`, size: 0, format };
      const doc = await documents.getDocument(id);
      const d = await import('docx');
      const body: (
        | InstanceType<typeof d.Paragraph>
        | InstanceType<typeof d.Table>
        | InstanceType<typeof d.TableOfContents>
      )[] = [
        new d.Paragraph({
          text: 'Software Requirements Specification',
          heading: d.HeadingLevel.TITLE,
          alignment: d.AlignmentType.CENTER,
          spacing: { before: 2000, after: 600 },
        }),
        new d.Paragraph({
          text: p.title,
          heading: d.HeadingLevel.TITLE,
          alignment: d.AlignmentType.CENTER,
        }),
        new d.Paragraph({
          text: `IEEE 830-1998\nVersi ${p.version}\n${p.domain}`,
          alignment: d.AlignmentType.CENTER,
          spacing: { before: 600 },
        }),
        new d.Paragraph({ children: [new d.PageBreak()] }),
        new d.TableOfContents('Daftar isi', { hyperlink: true, headingStyleRange: '1-3' }),
        new d.Paragraph({ children: [new d.PageBreak()] }),
      ];
      for (const chapter of (await import('@/entities/template/ieee')).ieeeTemplate.chapters) {
        body.push(
          new d.Paragraph({
            text: `${chapter.number}. ${chapter.title}`,
            heading: d.HeadingLevel.HEADING_1,
          }),
        );
        for (const s of doc.sections.filter((s) => s.number.startsWith(chapter.number + '.'))) {
          body.push(
            new d.Paragraph({ text: `${s.number} ${s.title}`, heading: d.HeadingLevel.HEADING_2 }),
          );
          const lines = s.markdown.split('\n');
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i]!;
            if (line.startsWith('|')) {
              const tableLines: string[] = [];
              while (i < lines.length && lines[i]!.startsWith('|')) {
                if (!/^\|\s*[-:]/.test(lines[i]!)) tableLines.push(lines[i]!);
                i++;
              }
              i--;
              body.push(
                new d.Paragraph({
                  text: `Tabel ${s.number}: ${s.title}`,
                  spacing: { before: 120, after: 120 },
                }),
              );
              body.push(
                new d.Table({
                  width: { size: 100, type: d.WidthType.PERCENTAGE },
                  rows: tableLines.map(
                    (row, ri) =>
                      new d.TableRow({
                        tableHeader: ri === 0,
                        children: row
                          .split('|')
                          .slice(1, -1)
                          .map(
                            (cell) =>
                              new d.TableCell({
                                children: [new d.Paragraph({ text: cell.trim() })],
                              }),
                          ),
                      }),
                  ),
                }),
              );
            } else if (line.trim())
              body.push(
                new d.Paragraph({
                  text: line.replace(/\*\*|^#{1,4} /g, ''),
                  spacing: { line: 360, after: 120 },
                }),
              );
          }
        }
      }
      const document = new d.Document({
        features: { updateFields: true },
        styles: {
          default: {
            title: {
              run: { font: 'Times New Roman', size: 48, bold: false },
              paragraph: { spacing: { line: 360 } },
            },
            heading1: {
              run: { font: 'Times New Roman', size: 32, bold: true },
              paragraph: { spacing: { line: 360, before: 320, after: 240 } },
            },
            heading2: {
              run: { font: 'Times New Roman', size: 28, bold: true },
              paragraph: { spacing: { line: 360, before: 240, after: 160 } },
            },
            heading3: {
              run: { font: 'Times New Roman', size: 24, bold: true },
              paragraph: { spacing: { line: 360 } },
            },
            document: {
              run: { font: 'Times New Roman', size: 24 },
              paragraph: { spacing: { line: 360 } },
            },
          },
        },
        sections: [
          {
            properties: {
              page: {
                size: { width: 11906, height: 16838 },
                margin: { top: 2268, left: 2268, right: 1701, bottom: 1701 },
              },
            },
            footers: {
              default: new d.Footer({
                children: [
                  new d.Paragraph({
                    alignment: d.AlignmentType.CENTER,
                    children: [new d.TextRun({ children: [d.PageNumber.CURRENT] })],
                  }),
                ],
              }),
            },
            children: body,
          },
        ],
      });
      const blob = await d.Packer.toBlob(document);
      return {
        url: URL.createObjectURL(blob),
        filename: `${p.title.replace(/[^a-z0-9 -]/gi, '')}-v${p.version}.docx`,
        size: blob.size,
        format,
      };
    },
  };
}
