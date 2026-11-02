import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }, info) => {
  await page.addInitScript((theme) => localStorage.setItem('theme', theme), info.project.name);
});

test('AI settings validate, save, simulate, remove and keep keys out of persistent storage', async ({
  page,
}, info) => {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.goto('/settings');
  const settings = page.getByRole('region', { name: 'Koneksi AI' });
  const model = settings.getByLabel('Model', { exact: true });
  const endpoint = settings.getByLabel('URL dasar API', { exact: true });
  const key = settings.getByLabel('API key AI', { exact: true });
  const save = settings.getByRole('button', { name: 'Simpan pengaturan AI', exact: true });
  const check = settings.getByRole('button', { name: 'Uji koneksi simulasi', exact: true });
  await expect(check).toBeDisabled();
  await endpoint.fill('http://invalid.example');
  await model.fill('');
  await key.fill('short');
  await save.click();
  for (const field of [model, endpoint, key])
    await expect(field).toHaveAttribute('aria-invalid', 'true');
  await settings.getByRole('combobox', { name: 'Penyedia AI', exact: true }).click();
  await page.getByRole('option', { name: 'Kustom (kompatibel OpenAI)', exact: true }).click();
  await model.fill('example-model');
  await endpoint.fill('https://example.com/v1');
  const testKey = 'example-key-browser-tests-only';
  await key.fill(testKey);
  await expect(key).toHaveAttribute('type', 'password');
  await settings.getByRole('button', { name: 'Tampilkan', exact: true }).click();
  await expect(key).toHaveAttribute('type', 'text');
  await save.click();
  await expect(key).toHaveValue('');
  await expect(key).toHaveAttribute('type', 'password');
  await expect(check).toBeEnabled();
  await check.click();
  await expect(settings.getByRole('status')).toContainText('Simulasi berhasil.');
  await expect(settings).toContainText('Tidak ada permintaan API yang dikirim.');
  expect(
    requests.some((url) => url.startsWith('https://example.com') || url.includes('/api/ai/')),
  ).toBe(false);
  const storage = await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('keyval-store');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      const values = await new Promise<unknown[]>((resolve, reject) => {
        const request = database.transaction('keyval').objectStore('keyval').getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      return JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage }, values });
    } finally {
      database.close();
    }
  });
  expect(storage).not.toContain(testKey);
  await settings.getByRole('button', { name: 'Hapus key', exact: true }).click();
  await expect(check).toBeDisabled();
  await key.fill(testKey);
  await save.click();
  await page.reload();
  await expect(model).toHaveValue('example-model');
  await expect(endpoint).toHaveValue('https://example.com/v1');
  await expect(key).toHaveValue('');
  await expect(check).toBeDisabled();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: `docs/screenshots/${info.project.name}-ai-settings-desktop.png`,
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 900 });
  await model.scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: `docs/screenshots/${info.project.name}-ai-settings-mobile.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Hapus semua data lokal', exact: true }).click();
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Hapus semua data lokal', exact: true })
    .click();
  await expect(model).toHaveValue('deepseek-chat');
  await expect(endpoint).toHaveValue('https://api.deepseek.com');
});

test('AI settings work in English, retain the key across navigation, and clear it for a new endpoint', async ({
  page,
}) => {
  await page.goto('/settings');
  await page.getByRole('combobox', { name: 'Bahasa antarmuka', exact: true }).click();
  await page.getByRole('option', { name: 'English', exact: true }).click();
  const settings = page.getByRole('region', { name: 'AI connection' });
  await settings.getByLabel('AI API key', { exact: true }).fill('example-key-navigation-only');
  await settings.getByRole('button', { name: 'Save AI settings', exact: true }).click();
  await expect(
    settings.getByRole('button', { name: 'Test simulated connection', exact: true }),
  ).toBeEnabled();
  await page.getByRole('link', { name: 'Documents', exact: true }).click();
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await expect(
    settings.getByRole('button', { name: 'Test simulated connection', exact: true }),
  ).toBeEnabled();
  await settings.getByLabel('API base URL', { exact: true }).fill('https://another.example.com/v1');
  await settings.getByRole('button', { name: 'Save AI settings', exact: true }).click();
  await expect(settings).toContainText('No API key configured.');
  await expect(
    settings.getByRole('button', { name: 'Test simulated connection', exact: true }),
  ).toBeDisabled();
});
