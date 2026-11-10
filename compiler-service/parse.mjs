import { readFile } from 'node:fs/promises';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
let task;
try {
  task = getDocument({
    data: new Uint8Array(await readFile(process.argv[2])),
    isEvalSupported: false,
    disableFontFace: true,
    useSystemFonts: false,
    verbosity: 0,
  });
  const pdf = await task.promise;
  if (pdf.numPages > 200) throw new Error('page_limit');
  const pages = [];
  let size = 0;
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i),
      content = await page.getTextContent();
    const text = content.items
      .map((item) => ('str' in item ? item.str + (item.hasEOL ? '\n' : ' ') : ''))
      .join('');
    size += Buffer.byteLength(text);
    if (size > 2 * 1024 * 1024) throw new Error('too_large');
    pages.push(text);
    page.cleanup();
  }
  if (!pages.some((page) => page.trim())) throw new Error('no_text_layer');
  process.stdout.write(JSON.stringify({ pages }));
} catch (error) {
  const code = ['page_limit', 'too_large', 'no_text_layer'].includes(error.message)
    ? error.message
    : error.name === 'PasswordException'
      ? 'encrypted_pdf'
      : 'invalid_file';
  process.stdout.write(JSON.stringify({ error: code }));
  process.exitCode = 1;
} finally {
  await task?.destroy();
}
