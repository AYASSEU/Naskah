import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { cleanPages } from '../../apps/web/src/entities/document/cleaning';
test.skip(process.env.NASKAH_E2E_MODE !== 'live', 'Requires the local server parser.');
test('server and browser PDF cleaning agree and scanned PDF shows OCR advice', async ({ page }) => {
  const require = createRequire(new URL('../../apps/web/package.json', import.meta.url));
  const pdfModule = await readFile(require.resolve('pdfjs-dist/build/pdf.mjs'));
  const fixture = await readFile('tests/fixtures/documents/text.pdf');
  await page.route('**/__test/pdf.mjs', (route) =>
    route.fulfill({ contentType: 'text/javascript', body: pdfModule }),
  );
  await page.route('**/__test/fixture.pdf', (route) =>
    route.fulfill({ contentType: 'application/pdf', body: fixture }),
  );
  await page.goto('/new-project');
  const pages = await page.evaluate(async () => {
    // The intercepted module is test-only; it creates no production endpoint.
    const pdfjs = await import(/* webpackIgnore: true */ '/__test/pdf.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
    const task = pdfjs.getDocument({
      data: await (await fetch('/__test/fixture.pdf')).arrayBuffer(),
    });
    try {
      const pdf = await task.promise,
        pages: string[] = [];
      for (let number = 1; number <= pdf.numPages; number++) {
        const page = await pdf.getPage(number),
          content = await page.getTextContent();
        pages.push(
          content.items
            .map((item: { str?: string; hasEOL?: boolean }) =>
              typeof item.str === 'string' ? item.str + (item.hasEOL ? '\n' : ' ') : '',
            )
            .join(''),
        );
        page.cleanup();
      }
      return pages;
    } finally {
      await task.destroy();
    }
  });
  const response = page.waitForResponse((r) => r.url().endsWith('/api/parse-pdf'));
  await page.locator('input[type="file"]').setInputFiles('tests/fixtures/documents/text.pdf');
  const parsed = await (await response).json();
  expect(parsed).toMatchObject(cleanPages(pages));
  await expect(page.locator('.uploaded-file')).toHaveCount(1);
  await page.locator('input[type="file"]').setInputFiles('tests/fixtures/documents/scanned.pdf');
  await expect(page.locator('.inline-error')).toContainText('OCR');
});
