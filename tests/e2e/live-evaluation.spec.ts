import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdirSync, appendFileSync } from 'node:fs';
test.skip(process.env.NASKAH_E2E_MODE !== 'live', 'Requires local B8 backend.');
test('live evaluation persists consent, blind ratings, SUS and verified metrics', async ({
  page,
  playwright,
}, info) => {
  test.setTimeout(120000);
  const code = 'B8UI_' + randomUUID().slice(0, 8);
  let caseId = '',
    projectId = '',
    created = false;
  let digest = '';
  await page.addInitScript((theme) => localStorage.setItem('theme', theme), info.project.name);
  const network: string[] = [];
  page.on('request', (r) => network.push(r.url()));
  await page.goto('/evaluation?tab=expert');
  await page.request.get('/api/auth/session', { headers: { 'X-Naskah-Client': 'web' } });
  const prior = (await (await page.request.get('/api/evaluation/cases?scope=dev')).json()) as {
    id: string;
  }[];
  try {
    await expect(
      page.getByText('Data uji memakai contoh dan provider mock.', { exact: false }),
    ).toBeVisible();
    await page.getByLabel('Kode peserta', { exact: true }).fill(code);
    await page.getByLabel('Saya menyetujui penyimpanan jawaban untuk evaluasi ini.').check();
    await page.getByRole('button', { name: 'Mulai sesi peserta', exact: true }).click();
    await expect(page.getByText('Peserta ' + code, { exact: false })).toBeVisible();
    const seed = page.waitForResponse(
      (r) => r.url().includes('/api/evaluation/seed') && r.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Siapkan kasus uji', exact: true }).click();
    const c = await (await seed).json();
    caseId = c.id;
    projectId = c.projectId;
    created = !prior.some((p) => p.id === caseId);
    await expect(page.getByRole('heading', { name: 'Dokumen A', exact: true })).toBeVisible();
    const submit = async (label: 'A' | 'B', rating: number) => {
      await page.getByRole('button', { name: 'Dokumen ' + label, exact: true }).click();
      for (const dimension of ['unambiguous', 'complete', 'correct', 'verifiable'])
        await page
          .getByRole('radio', { name: `${label}-${dimension}: ${rating}`, exact: true })
          .check();
      for (const box of await page.getByRole('textbox', { name: /Alasan/ }).all())
        await box.fill('Alasan penilaian sintetis dari UI.');
      await page.getByRole('button', { name: 'Kirim penilaian', exact: true }).click();
      await expect(
        page.getByRole('button', { name: 'Penilaian tersimpan', exact: true }),
      ).toBeDisabled();
    };
    await submit('A', 4);
    expect(
      (await page.request.get('/api/evaluation/mapping?scope=dev&caseId=' + caseId)).status(),
    ).toBe(403);
    await submit('B', 3);
    await page.reload();
    await page.getByRole('button', { name: 'Lihat pemetaan sumber', exact: true }).click();
    await expect(
      page.getByText(/A: (Sistem dengan provider mock|Baseline manusia sintetis)/),
    ).toBeVisible();
    await page.getByRole('tab', { name: 'SUS', exact: true }).click();
    for (let i = 1; i <= 10; i++)
      await page.getByRole('radio', { name: `SUS ${i}: ${i % 2 ? 5 : 1}`, exact: true }).check();
    await page.getByRole('button', { name: 'Kirim jawaban SUS', exact: true }).click();
    await expect(page.locator('.result-panel')).toContainText('100.0 / 100');
    await page.reload();
    await expect(page.locator('.result-panel')).toContainText('100.0 / 100');
    await page.getByRole('tab', { name: 'Penilaian pakar', exact: true }).click();
    const other = await playwright.request.newContext({ baseURL: 'http://127.0.0.1:3000' });
    try {
      const headers = { 'X-Naskah-Client': 'web', Origin: 'http://127.0.0.1:3000' };
      await other.get('/api/auth/session', { headers });
      expect(
        (
          await other.post('/api/evaluation/context?scope=dev', {
            headers,
            data: { code: code + '_other', role: 'expert', consent: true },
          })
        ).ok(),
      ).toBeTruthy();
      const docs = await (
        await other.get('/api/evaluation/blind?scope=dev&caseId=' + caseId)
      ).json();
      for (const d of docs)
        expect(
          (
            await other.post('/api/evaluation/reviews?scope=dev', {
              headers,
              data: {
                assignmentId: d.id,
                ratings: [4, 4, 4, 4],
                justifications: ['one', 'two', 'three', 'four'],
                comments: '',
              },
            })
          ).ok(),
        ).toBeTruthy();
    } finally {
      await other.dispose();
    }
    const statisticsResponse = page.waitForResponse(
      (r) =>
        r.url().includes('/api/evaluation/statistics?scope=dev') && r.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Hitung statistik', exact: true }).click();
    digest = (await (await statisticsResponse).json()).provenance?.input_digest ?? '';
    await expect(page.getByText('Desain analisis: Berpasangan', { exact: false })).toBeVisible({
      timeout: 20000,
    });
    await page.getByRole('tab', { name: 'ROUGE', exact: true }).click();
    await page.getByRole('button', { name: 'Hitung ROUGE', exact: true }).click();
    await expect(
      page.getByRole('cell', { name: 'Bahasa sesuai', exact: true }).first(),
    ).toBeVisible({ timeout: 20000 });
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Ekspor JSON', exact: true }).click();
    await download;
    await page.getByLabel('Kelompok data', { exact: true }).selectOption('research');
    await expect(
      page.getByText('Hanya run penelitian yang memenuhi syarat.', { exact: false }),
    ).toBeVisible();
    const research = await (
      await page.request.get('/api/evaluation/export?scope=research&format=json')
    ).json();
    expect(Object.values(research.datasets).flat()).toHaveLength(0);
    await expect(page.getByRole('button', { name: 'Hitung ROUGE', exact: true })).toBeDisabled();
    await expect(page.getByText('Memuat dokumen…', { exact: true })).toHaveCount(0);
    await page.screenshot({
      path: `artifacts/b8-${info.project.name}-research.png`,
      fullPage: true,
    });
    expect(network.filter((url) => /:(?:5678|54321|4010|8000|8010)\//.test(url))).toEqual([]);
  } finally {
    mkdirSync('artifacts/b8', { recursive: true });
    appendFileSync(
      'artifacts/b8/ui-cleanup.jsonl',
      JSON.stringify({ code, digest, created, projectId }) + '\n',
    );
  }
});
test('late responses cannot replace the selected evaluation scope', async ({ page }) => {
  await page.goto('/evaluation');
  await expect(page.getByLabel('Kelompok data', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Kelompok data', { exact: true })).toBeEnabled();
  let finish!: () => void;
  const completed = new Promise<void>((resolve) => {
    finish = resolve;
  });
  await page.route('**/api/evaluation/overview?scope=research*', async (route) => {
    const response = await route.fetch();
    await new Promise((resolve) => setTimeout(resolve, 800));
    await route.fulfill({ response });
    finish();
  });
  const pending = page.waitForRequest((r) =>
    r.url().includes('/api/evaluation/overview?scope=research'),
  );
  await page.getByLabel('Kelompok data', { exact: true }).selectOption('research');
  await pending;
  await page.getByLabel('Kelompok data', { exact: true }).selectOption('dev');
  await expect(
    page.getByText('Data uji memakai contoh dan provider mock.', { exact: false }),
  ).toBeVisible();
  await completed;
  await expect(page.getByLabel('Kelompok data', { exact: true })).toHaveValue('dev');
  await expect(
    page.getByText('Data uji memakai contoh dan provider mock.', { exact: false }),
  ).toBeVisible();
  await page.unrouteAll({ behavior: 'wait' });
});
