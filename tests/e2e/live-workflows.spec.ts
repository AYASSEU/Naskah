import { test, expect } from '@playwright/test';
import { mkdir, readFile } from 'node:fs/promises';
import { unzipSync, strFromU8 } from 'fflate';
import type { SrsDocument } from '../../packages/contracts/src/index';
test.skip(
  process.env.NASKAH_E2E_MODE !== 'live',
  'Requires the local B6 backend and mock provider.',
);
test('live UI generates, persists, edits, reviews revisions and exports local data', async ({
  page,
}, info) => {
  test.setTimeout(120000);
  await page.addInitScript((theme) => localStorage.setItem('theme', theme), info.project.name);
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  let projectId = '';
  const document = async () => {
    const response = await page.request.get(`/api/documents/${projectId}`);
    expect(response.ok()).toBeTruthy();
    return response.json() as Promise<SrsDocument>;
  };
  const revise = async (sectionId: string, instruction: string) => {
    await page
      .locator(`[id="section-${sectionId}"]`)
      .getByRole('button', { name: 'Revisi AI', exact: true })
      .click();
    await page.getByRole('dialog').getByRole('textbox').fill(instruction);
    await page.getByRole('button', { name: 'Kirim revisi', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Tinjau usulan revisi' })).toBeVisible({
      timeout: 25000,
    });
  };
  try {
    await page.goto('/new-project');
    await page
      .locator('input[type="file"]')
      .setInputFiles(['tests/fixtures/documents/text.pdf', 'tests/fixtures/documents/notes.txt']);
    await expect(page.locator('.uploaded-file')).toHaveCount(2);
    await expect(page.locator('.uploaded-file').filter({ hasText: 'text.pdf' })).toContainText('3');
    await page
      .getByLabel('Nama dokumen', { exact: true })
      .fill(`B6 synthetic UI ${info.project.name}`);
    await page
      .getByLabel('Deskripsi sistem', { exact: true })
      .fill('Petugas harus menyimpan data pasien. Sistem harus mencatat audit akses lokal.');
    await expect(
      page.getByRole('button', { name: 'Mulai buat dokumen SRS', exact: true }),
    ).toBeEnabled();
    await page.getByRole('button', { name: 'Mulai buat dokumen SRS', exact: true }).click();
    await expect(page).toHaveURL(/workspace\//);
    projectId = new URL(page.url()).pathname.split('/')[2]!;
    await expect(
      page.getByRole('button', { name: 'Setujui dan finalisasi', exact: true }),
    ).toBeEnabled({ timeout: 45000 });
    const generated = await document();
    expect(generated.sections).toHaveLength(15);
    expect(generated.sections.every((s) => s.version === 2)).toBeTruthy();
    const first = page.locator('[id="section-1.1"]');
    await first.getByRole('button', { name: 'Edit', exact: true }).click();
    let delayed = false;
    await page.route('**/api/sections/1.1', async (route) => {
      if (route.request().method() === 'PUT' && !delayed) {
        delayed = true;
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
      await route.continue();
    });
    const firstSave = page.waitForRequest(
      (request) => request.url().endsWith('/api/sections/1.1') && request.method() === 'PUT',
    );
    const editor = first.getByRole('textbox', { name: 'Markdown', exact: true });
    await editor.fill((await editor.inputValue()) + '\n\nCatatan manual B6 dari UI.');
    await firstSave;
    await editor.fill((await editor.inputValue()) + '\n\nTambahan saat autosave masih berjalan.');
    await first.getByRole('button', { name: 'Selesai mengedit', exact: true }).click();
    await expect(editor).toBeHidden({ timeout: 15000 });
    await expect(first).toContainText('Catatan manual B6 dari UI.');
    await page.reload();
    await expect(first).toContainText('Catatan manual B6 dari UI.');
    await expect(first).toContainText('Tambahan saat autosave masih berjalan.');
    const stored = await document(),
      old = stored.sections.find((section) => section.id === '1.1')!;
    await first.getByRole('button', { name: 'Edit', exact: true }).click();
    const external = await page.request.put('/api/sections/1.1', {
      headers: {
        'X-Naskah-Client': 'web',
        Origin: new URL(page.url()).origin,
        'If-Match': String(old.version),
      },
      data: {
        projectId,
        section: {
          ...old,
          markdown: old.markdown + '\n\nEdit dari tab lain.',
          status: 'edited',
          source: 'human',
        },
      },
    });
    expect(external.status()).toBe(200);
    const conflicting = first.getByRole('textbox', { name: 'Markdown', exact: true });
    await conflicting.fill(old.markdown + '\n\nDraf lokal yang ditinjau.');
    await first.getByRole('button', { name: 'Selesai mengedit', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Versi tersimpan terbaru', exact: true }),
    ).toBeVisible();
    await expect(page.locator('.diff-grid')).toContainText('Edit dari tab lain.');
    await expect(page.locator('.diff-grid')).toContainText('Draf lokal yang ditinjau.');
    const reviewedSave = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/sections/1.1') &&
        response.request().method() === 'PUT' &&
        response.status() === 200,
    );
    await page
      .getByRole('button', { name: 'Simpan draf yang telah ditinjau', exact: true })
      .click();
    await reviewedSave;
    await expect(
      page.getByRole('heading', { name: 'Versi tersimpan terbaru', exact: true }),
    ).toBeHidden();
    await expect(conflicting).toBeHidden();
    await expect(first).toContainText('Draf lokal yang ditinjau.');
    const before = await document();
    await revise('3.2', 'Tambahkan catatan audit B6 pada kebutuhan fungsional.');
    expect(await document()).toEqual(before);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Tinjau usulan revisi' })).toBeVisible({
      timeout: 15000,
    });
    await page.getByRole('button', { name: 'Terapkan perubahan', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Tinjau usulan revisi' })).toBeHidden();
    const accepted = await document();
    expect(accepted.sections.find((s) => s.id === '3.2')!.version).toBe(
      before.sections.find((s) => s.id === '3.2')!.version! + 1,
    );
    expect(accepted.sections.filter((s) => s.id !== '3.2')).toEqual(
      before.sections.filter((s) => s.id !== '3.2'),
    );
    await expect(page.locator('[id="section-3.2"]')).toContainText('catatan audit B6');
    await revise('1.2', 'Usulan yang akan ditolak B6.');
    await page.getByRole('dialog').getByRole('button', { name: 'Batalkan', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Tinjau usulan revisi' })).toBeHidden();
    expect(await document()).toEqual(accepted);
    await mkdir('artifacts', { recursive: true });
    await page.screenshot({
      path: `artifacts/b6-${info.project.name}-workspace.png`,
      fullPage: true,
    });
    await page.getByRole('button', { name: 'Setujui dan finalisasi', exact: true }).click();
    await page.getByLabel('Saya telah meninjau dokumen ini').check();
    await page.getByRole('button', { name: 'Finalisasi dokumen', exact: true }).click();
    await expect(page).toHaveURL(/export\//);
    await page.getByLabel('Penulis (opsional)').fill('Penguji UI');
    await page.getByLabel('Institusi (opsional)').fill('Naskah');
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Unduh dokumen Word', exact: true }).click();
    const file = await download,
      zip = unzipSync(new Uint8Array(await readFile((await file.path())!)));
    expect(strFromU8(zip['word/document.xml']!)).toContain('Catatan manual B6 dari UI.');
    const pdfDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Simpan sebagai PDF', exact: true }).click();
    const pdfFile = await pdfDownload,
      pdfBytes = await readFile((await pdfFile.path())!);
    expect(pdfBytes.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdfBytes.length).toBeGreaterThan(1000);
    await page.screenshot({
      path: 'artifacts/b7-' + info.project.name + '-export.png',
      fullPage: true,
    });
    expect(
      requests.filter((url) =>
        /https?:\/\/(?:localhost|127\.0\.0\.1|host\.docker\.internal):(?:5678|54321|4010)/.test(
          url,
        ),
      ),
    ).toEqual([]);
  } finally {
    if (projectId)
      await page.request.delete(`/api/projects/${projectId}`, {
        headers: { 'X-Naskah-Client': 'web', Origin: new URL(page.url()).origin },
      });
  }
});
