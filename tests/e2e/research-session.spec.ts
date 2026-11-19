import { test, expect } from '@playwright/test';
test('independent expert session survives reload and unlocks SUS after submission', async ({
  page,
}) => {
  await page.goto('/evaluation');
  await page.getByLabel('Nama sesi').fill('Pilot instrumen');
  await page.getByRole('button', { name: 'Mulai sesi penilaian' }).click();
  await page.getByLabel('Inisial peserta').fill('AK');
  await page.getByLabel('Profesi peserta').fill('System Analyst');
  await page.getByLabel('Tanggal penilaian').fill('2026-11-17');
  await page.getByRole('button', { name: 'Simpan identitas dan lanjutkan' }).click();
  await page.getByRole('button', { name: 'Lanjut ke kriteria' }).click();
  await page.getByRole('button', { name: 'Lanjut ke form penilaian' }).click();
  await page.getByRole('button', { name: 'Simpan penelitian' }).click();
  await expect(page.getByRole('button', { name: 'SUS', exact: true })).toBeDisabled();
  for (const radio of await page.locator('input[type=radio][value="4"]').all()) await radio.check();
  await page.getByRole('button', { name: 'Simpan penelitian' }).click();
  await expect(page.getByText('Rata-rata skor pakar')).toBeVisible();
  await page.getByRole('button', { name: 'SUS', exact: true }).click();
  for (const radio of await page.locator('input[type=radio][value="5"]').all()) await radio.check();
  await page.getByRole('button', { name: 'Simpan SUS' }).click();
  await expect(page.getByText('Skor SUS Anda: 50/100')).toBeVisible();
  await page.getByRole('button', { name: 'Hasil', exact: true }).click();
  await page.getByLabel('Kode proyek').selectOption('B');
  const card = page.getByRole('region', { name: 'Rata-rata SUS' });
  await expect(card).toContainText('50/100');
  await expect(card).toContainText('1 respons lengkap');
  await card.getByText('Lihat rincian SUS').click();
  const scroll = card.getByRole('region', { name: 'Tabel rincian SUS' });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await scroll.evaluate((el) => {
        el.scrollLeft = 120;
        return el.scrollLeft > 0;
      }),
    ).toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);
  }
  const downloading = page.waitForEvent('download');
  await card.getByRole('button', { name: 'Unduh CSV SUS' }).click();
  const file = await downloading;
  const { readFile } = await import('node:fs/promises');
  const csv = await readFile((await file.path())!, 'utf8');
  expect(csv.split('\r\n')).toHaveLength(2);
  expect(csv).toContain('"Skor SUS"');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Pilot instrumen' })).toBeVisible();
  await page.getByRole('button', { name: 'Muat sesi' }).click();
  await page.getByRole('button', { name: 'SUS', exact: true }).click();
  await expect(page.getByText('Skor SUS Anda: 50/100')).toBeVisible();
});

test('multiple experts and sessions aggregate by project and export individual scores', async ({
  page,
  request,
}) => {
  await page.goto('/evaluation');
  for (const code of ['A', 'B', 'C']) {
    for (const name of ['brief', code + '01', code + '02', code + '03']) {
      const response = await request.get('/research/' + code + '/' + name + '.pdf');
      expect(response.ok()).toBe(true);
      expect((await response.body()).subarray(0, 4).toString()).toBe('%PDF');
    }
  }
  for (const [session, ratings] of [
    ['Pilot A', [1, 3]],
    ['Pilot B', [5]],
  ] as const) {
    await page.getByRole('button', { name: 'Ringkasan', exact: true }).click();
    await page.getByLabel('Nama sesi').fill(session);
    await page.getByRole('button', { name: 'Mulai sesi penilaian' }).click();
    for (const rating of ratings) {
      await page.getByRole('button', { name: 'Penilaian pakar', exact: true }).click();
      await page.getByLabel('Inisial peserta').fill('AK');
      await page.getByLabel('Profesi peserta').fill('Technical Writer');
      await page.getByLabel('Tanggal penilaian').fill('2026-11-17');
      await page.getByRole('button', { name: 'Simpan identitas dan lanjutkan' }).click();
      await page.getByRole('button', { name: 'Lanjut ke kriteria' }).click();
      await page.getByRole('button', { name: 'Lanjut ke form penilaian' }).click();
      for (const radio of await page.locator('input[type=radio][value="' + rating + '"]').all())
        await radio.check();
      await page.getByRole('button', { name: 'Simpan penelitian' }).click();
      await expect(page.getByText('Rata-rata skor pakar')).toBeVisible();
    }
  }
  await page.getByLabel('Pilot A', { exact: true }).check();
  await expect(page.getByRole('cell', { name: '3.00', exact: true })).toHaveCount(12);
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Unduh rincian CSV' }).click();
  const file = await downloading;
  const { readFile } = await import('node:fs/promises');
  const csv = await readFile((await file.path())!, 'utf8');
  expect(csv.split('\r\n')).toHaveLength(37);
  await page.getByRole('button', { name: 'Ringkasan', exact: true }).click();
  page.once('dialog', (dialog) => dialog.accept());
  await page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Pilot A', exact: true }) })
    .getByRole('button', { name: 'Hapus sesi' })
    .click();
  await expect(page.getByRole('heading', { name: 'Pilot A', exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Pilot B', exact: true })).toBeVisible();
});
