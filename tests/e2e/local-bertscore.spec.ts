import { test, expect } from '@playwright/test';
test('scores a real text pair with the local Docker evaluator', async ({ page }) => {
  test.skip(process.env.TEST_LOCAL_BERTSCORE !== '1', 'Requires the local evaluator container');
  await page.goto('/evaluation/bertscore');
  const text = 'Sistem harus mencatat transaksi.';
  await page.getByLabel('Teks kandidat').fill(text);
  await page.getByLabel('Teks referensi').fill(text);
  await page.getByRole('button', { name: 'Hitung BERTScore lokal' }).click();
  await expect(page.locator('form output')).toContainText('F1 1.0000', { timeout: 75000 });
});
