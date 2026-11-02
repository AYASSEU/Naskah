import { test, expect } from '@playwright/test';
import { unzipSync, strFromU8 } from 'fflate';
import { readFile, mkdir } from 'node:fs/promises';
test.beforeEach(async ({ page }, info) => {
  await page.addInitScript((theme) => localStorage.setItem('theme', theme), info.project.name);
});

test('mobile SUS presents one item per step and keeps its score', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto('/evaluation?tab=sus');
  for (let i = 0; i < 10; i++) {
    await expect(page.getByRole('radio')).toHaveCount(5);
    await page
      .getByRole('radio', { name: `SUS ${i + 1}: ${i % 2 === 0 ? 5 : 1}`, exact: true })
      .check();
    if (i < 9) await page.getByRole('button', { name: 'Berikutnya', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Kirim jawaban SUS', exact: true }).click();
  await expect(page.locator('.result-panel')).toContainText('100.0');
  await page.screenshot({
    path: `docs/screenshots/${info.project.name}-sus-mobile-390.png`,
    fullPage: true,
  });
});

test('two concurrent revisions keep both proposals and isolate their target sections', async ({
  page,
}) => {
  await page.goto('/workspace/e73b9f22-1648-4619-a410-000000000001');
  for (const [id, instruction] of [
    ['1.1', 'Tambahkan audit trail pada autentikasi'],
    ['1.2', 'Wajibkan 2-Factor Authentication dan enkripsi AES-256'],
  ]) {
    await page
      .locator(`#section-${id!.replace('.', '\\.')}`)
      .getByRole('button', { name: 'Revisi AI', exact: true })
      .click();
    await page.getByRole('button', { name: instruction, exact: true }).click();
    await page.getByRole('button', { name: 'Kirim revisi', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Batalkan', exact: true }).click();
  }
  await expect(page.getByRole('heading', { name: 'Tinjau usulan revisi' })).toBeVisible();
  await expect(page.locator('.diff-tools')).toContainText('1.1');
  await page.getByRole('button', { name: 'Terapkan perubahan', exact: true }).click();
  await expect(page.locator('.diff-tools')).toContainText('1.2');
  await page.getByRole('button', { name: 'Terapkan perubahan', exact: true }).click();
  await expect(page.locator('#section-1\\.1')).toContainText('90 hari');
  await expect(page.locator('#section-1\\.2')).toContainText('TOTP');
});
test('text intake, generation, manual edit, revision accept/reject, finalization and genuine DOCX', async ({
  page,
}) => {
  await page.goto('/new-project');
  await page.getByLabel('Nama dokumen', { exact: true }).fill('Sistem klinik mahasiswa');
  await page
    .getByLabel('Deskripsi sistem', { exact: true })
    .fill(
      'Petugas klinik mendaftarkan pasien mahasiswa dan mengatur jadwal dokter. Sistem menyimpan rekam medis dengan hak akses berdasarkan peran. Waktu respons maksimal 2 detik.',
    );
  await page.getByRole('button', { name: 'Mulai buat dokumen SRS', exact: true }).click();
  await expect(page).toHaveURL(/workspace/);
  await expect(
    page.getByRole('button', { name: 'Setujui dan finalisasi', exact: true }),
  ).toBeEnabled({ timeout: 45000 });
  const first = page.locator('#section-1\\.1');
  await first.getByRole('button', { name: 'Edit', exact: true }).click();
  const editor = first.getByRole('textbox', { name: 'Markdown', exact: true });
  await editor.fill((await editor.inputValue()) + '\n\nCatatan verifikasi oleh mahasiswa.');
  await first.getByRole('button', { name: 'Selesai mengedit', exact: true }).click();
  await expect(first).toContainText('Catatan verifikasi oleh mahasiswa.');
  const security = page.locator('#section-3\\.4');
  await security.getByRole('button', { name: 'Revisi AI', exact: true }).click();
  await page
    .getByRole('button', {
      name: 'Wajibkan 2-Factor Authentication dan enkripsi AES-256',
      exact: true,
    })
    .click();
  await page.getByRole('button', { name: 'Kirim revisi', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tinjau usulan revisi' })).toBeVisible();
  await expect(page.locator('.diff-content').last()).toContainText('TOTP');
  await page.getByRole('button', { name: 'Terapkan perubahan', exact: true }).click();
  await expect(security).toContainText('TOTP');
  const before = await security.locator('.manuscript-text').first().innerText();
  await security.getByRole('button', { name: 'Revisi AI', exact: true }).click();
  await page
    .getByRole('button', { name: 'Tambahkan audit trail pada autentikasi', exact: true })
    .click();
  await page.getByRole('button', { name: 'Kirim revisi', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tinjau usulan revisi' })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Batalkan', exact: true }).click();
  await expect(security.locator('.manuscript-text').first()).toHaveText(before, {
    useInnerText: true,
  });
  await page.getByRole('button', { name: 'Setujui dan finalisasi', exact: true }).click();
  await page.getByLabel('Saya telah meninjau dokumen ini').check();
  await page.getByRole('button', { name: 'Finalisasi dokumen', exact: true }).click();
  await expect(page).toHaveURL(/export/);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Unduh dokumen Word', exact: true }).click();
  const file = await download;
  const buffer = await readFile((await file.path())!);
  const zip = unzipSync(buffer);
  expect(strFromU8(zip['word/document.xml']!)).toContain('Catatan verifikasi oleh mahasiswa.');
});
test('PDF and notes are parsed and merged before generation', async ({ page }) => {
  const text = 'Wawancara: pasien memesan jadwal dokter melalui aplikasi.';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${text.length + 32} >>\nstream\nBT /F1 12 Tf 50 750 Td (${text}) Tj ET\nendstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((n) => String(n).padStart(10, '0') + ' 00000 n \n')
    .join('')}trailer\n<< /Root 1 0 R /Size 6 >>\nstartxref\n${xref}\n%%EOF`;
  await page.goto('/new-project');
  await page.getByLabel('Nama dokumen', { exact: true }).fill('Klinik dari wawancara');
  await page.getByLabel('Deskripsi sistem', { exact: true }).fill('Catatan tambahan: tujuh aktor.');
  await page.locator('input[type=file]').setInputFiles({
    name: 'wawancara.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(pdf),
  });
  await expect(page.locator('.uploaded-file')).toContainText('wawancara.pdf');
  await page.getByText('Tinjau teks hasil ekstraksi', { exact: true }).click();
  await expect(
    page.getByRole('textbox', { name: 'Tinjau teks hasil ekstraksi: wawancara.pdf' }),
  ).toHaveValue(/pasien memesan jadwal/);
  await page.getByRole('button', { name: 'Mulai buat dokumen SRS', exact: true }).click();
  await expect(page).toHaveURL(/workspace/);
});
test('failed project resumes without losing the completed introduction', async ({ page }) => {
  await page.goto('/workspace/e73b9f22-1648-4619-a410-000000000003');
  await expect(page.locator('#section-1\\.1')).toContainText('Dokumen ini menetapkan');
  await page.getByRole('button', { name: 'Lanjutkan penyusunan', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Setujui dan finalisasi', exact: true }),
  ).toBeEnabled({ timeout: 45000 });
  await expect(page.locator('#section-1\\.1')).toContainText('Dokumen ini menetapkan');
  await expect(page.locator('#section-3\\.2')).toContainText('Peminjaman digital');
});
test('SUS scoring and expert blind assessment', async ({ page }) => {
  await page.goto('/evaluation?tab=sus');
  await expect(
    page.getByRole('heading', { name: 'System Usability Scale', exact: true }),
  ).toBeVisible();
  for (let i = 0; i < 10; i++)
    await page
      .getByRole('radio', { name: `SUS ${i + 1}: ${i % 2 === 0 ? 5 : 1}`, exact: true })
      .check();
  await page.getByRole('button', { name: 'Kirim jawaban SUS', exact: true }).click();
  await expect(page.locator('.result-panel')).toContainText('100.0');
  await page.getByRole('tab', { name: 'Penilaian pakar', exact: true }).click();
  await page.getByLabel('Nama samaran penilai', { exact: true }).fill('Pakar-07');
  for (const dim of ['unambiguous', 'complete', 'correct', 'verifiable'])
    await page.getByRole('radio', { name: `A-${dim}: 4`, exact: true }).check();
  for (const textarea of await page.locator('.expert-dimension textarea').all())
    await textarea.fill('Kriteria penerimaan memuat aktor dan hasil yang dapat diperiksa.');
  await page.getByRole('button', { name: 'Kirim penilaian', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Penilaian tersimpan', exact: true }),
  ).toBeVisible();
});
test('responsive screenshots and locale switching', async ({ page }, info) => {
  await mkdir('docs/screenshots', { recursive: true });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const width of [1440, 1024, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Dokumen Anda' })).toBeVisible();
    await expect(page.locator('.project-table tbody tr')).toHaveCount(3);
    await page.screenshot({
      path: `docs/screenshots/${info.project.name}-ledger-${width}.png`,
      fullPage: true,
    });
    await page.goto('/new-project');
    await expect(page.getByRole('heading', { name: 'Mulai dari konteks Anda.' })).toBeVisible();
    await page.screenshot({
      path: `docs/screenshots/${info.project.name}-intake-${width}.png`,
      fullPage: true,
    });
    await page.goto('/workspace/e73b9f22-1648-4619-a410-000000000001');
    await expect(page.locator('.manuscript-title')).toContainText('Sistem Manajemen Rumah Sakit');
    await page.screenshot({
      path: `docs/screenshots/${info.project.name}-workspace-${width}.png`,
      fullPage: true,
    });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }
  await page.goto('/');
  await page.getByRole('button', { name: 'Bahasa antarmuka', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your documents', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('revision, finalized export and generation screenshots at four widths', async ({
  browser,
}, info) => {
  await mkdir('docs/screenshots', { recursive: true });
  for (const width of [1440, 1024, 768, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      colorScheme: info.project.name as 'dark' | 'light',
    });
    await context.addInitScript((theme) => localStorage.setItem('theme', theme), info.project.name);
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:3000/workspace/e73b9f22-1648-4619-a410-000000000001');
    const security = page.locator('#section-3\\.4');
    await security.getByRole('button', { name: 'Revisi AI', exact: true }).click();
    await page
      .getByRole('button', {
        name: 'Wajibkan 2-Factor Authentication dan enkripsi AES-256',
        exact: true,
      })
      .click();
    await page.getByRole('button', { name: 'Kirim revisi', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Tinjau usulan revisi' })).toBeVisible();
    await page.screenshot({ path: `docs/screenshots/${info.project.name}-diff-${width}.png` });
    await page.getByRole('dialog').getByRole('button', { name: 'Batalkan', exact: true }).click();
    await page.getByRole('button', { name: 'Setujui dan finalisasi', exact: true }).click();
    await page.getByLabel('Saya telah meninjau dokumen ini').check();
    await page.getByRole('button', { name: 'Finalisasi dokumen', exact: true }).click();
    await expect(page).toHaveURL(/export/);
    await page.screenshot({
      path: `docs/screenshots/${info.project.name}-export-${width}.png`,
      fullPage: true,
    });
    await page.goto('http://127.0.0.1:3000/workspace/e73b9f22-1648-4619-a410-000000000003');
    await page.getByRole('button', { name: 'Lanjutkan penyusunan', exact: true }).click();
    await expect(page.locator('.document-meta')).toContainText('Sedang disusun');
    await page.screenshot({
      path: `docs/screenshots/${info.project.name}-generating-${width}.png`,
    });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await context.close();
  }
});
