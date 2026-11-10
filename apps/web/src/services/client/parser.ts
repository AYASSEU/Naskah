import type { ParserService } from '../ports';
import { PortError } from '../ports';
import { cleanPages } from '@/entities/document/cleaning';
export const parser: ParserService = {
  async extractText(file) {
    if (!/\.(pdf|txt)$/i.test(file.name)) throw new PortError('invalid_file', false, 'invalidFile');
    if (file.size > 10 * 1024 * 1024) throw new PortError('too_large', false, 'fileTooLarge');
    let pages: string[];
    if (/\.txt$/i.test(file.name)) pages = [await file.text()];
    else {
      const pdfjs = await import('pdfjs-dist');
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
      const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
      pages = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const content = await (await pdf.getPage(i)).getTextContent();
        pages.push(
          content.items
            .map((item) =>
              'str' in item ? item.str + ('hasEOL' in item && item.hasEOL ? '\n' : ' ') : '',
            )
            .join(''),
        );
      }
    }
    return { name: file.name, size: file.size, ...cleanPages(pages) };
  },
};
