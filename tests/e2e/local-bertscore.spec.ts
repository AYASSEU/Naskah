import { test, expect } from '@playwright/test';
test('compares two methods against one human baseline using local inference', async ({ page }) => {
  test.skip(process.env.TEST_LOCAL_BERTSCORE !== '1', 'Requires Docker evaluator');
  test.setTimeout(180000);
  await page.goto('/evaluation/bertscore');
  const file = {
    name: 'baseline.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('Sistem harus mencatat transaksi.'),
  };
  await page.getByLabel('SRS baseline manusia').setInputFiles(file);
  await page
    .getByLabel('SRS pembanding', { exact: true })
    .setInputFiles({ ...file, name: 'llm.txt' });
  await page.getByLabel('Bahasa pembanding').selectOption('en');
  const submit = page.getByRole('button', { name: 'Hitung BERTScore lokal' });
  await expect(submit).toBeDisabled();
  await page.getByLabel('Bahasa pembanding').selectOption('id');
  await submit.click();
  await expect(page.getByRole('cell', { name: '1.0000', exact: true }).first()).toBeVisible({
    timeout: 120000,
  });
  await page.getByRole('button', { name: 'Bandingkan metode lain' }).click();
  await page
    .getByLabel('SRS pembanding', { exact: true })
    .setInputFiles('tests/fixtures/documents/text.pdf');
  await submit.click();
  await expect(page.getByText(/Selisih F1/)).toBeVisible({ timeout: 120000 });
  await page.reload();
  await expect(page.getByText(/Selisih F1/)).toBeVisible();
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Unduh CSV BERTScore' }).click();
  const path = await (await downloading).path();
  const csv = await (await import('node:fs/promises')).readFile(path!, 'utf8');
  expect(csv.split('\r\n')).toHaveLength(3);
  expect(csv).toContain('SHA256_baseline');
});
test('explains unreadable or oversized inputs and evaluator downtime', async ({ page }) => {
  await page.goto('/evaluation/bertscore');
  const base = page.getByLabel('SRS baseline manusia');
  const file = (text: string) => ({
    name: 'srs.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from(text),
  });
  await base.setInputFiles(file(''));
  await expect(page.locator('main').getByRole('alert')).toContainText('OCR');
  await base.setInputFiles('tests/fixtures/documents/scanned.pdf');
  await expect(page.locator('main').getByRole('alert')).toContainText('OCR');
  await base.setInputFiles(file('x'.repeat(100001)));
  await expect(page.locator('main').getByRole('alert')).toContainText('100.000');
  await base.setInputFiles(file('Sistem mencatat transaksi.'));
  await page
    .getByLabel('SRS pembanding', { exact: true })
    .setInputFiles(file('Sistem menyimpan transaksi.'));
  await page.route('**/api/local-bertscore', (r) =>
    r.fulfill({ status: 503, json: { code: 'evaluation_unavailable' } }),
  );
  await page.getByRole('button', { name: 'Hitung BERTScore lokal' }).click();
  await expect(page.getByText(/Evaluator lokal belum siap/)).toBeVisible();
});

