import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { unzipSync, strFromU8 } from 'fflate';
import {
  bootstrap,
  createFromUi,
  generated,
  document,
  mock,
  record,
  freshPrefix,
  runtime,
  headers,
} from './b9-support';
test.skip(process.env.NASKAH_E2E_MODE !== 'live', 'Requires guarded local mock B9 services.');
for (const input of ['text', 'pdf-recovery'] as const)
  test(
    'whole local system: ' + input + ' through revision, exports and evaluation',
    async ({ page }, info) => {
      test.setTimeout(240000);
      page.setDefaultTimeout(25000);
      page.on('dialog', (d) => void d.accept());
      await runtime('preflight');
      await bootstrap(page);
      await mock('reset');
      await page.addInitScript((theme) => localStorage.setItem('theme', theme), info.project.name);
      const prefix = freshPrefix(),
        marker = 'Catatan manual ' + prefix,
        acceptedMarker = 'Tambahkan audit ' + prefix,
        network: string[] = [];
      let projectId = '',
        caseId = '',
        dropped = false,
        reconnected = false;
      const digests: string[] = [];
      page.on('request', (request) => {
        network.push(request.url());
        if (request.url().endsWith('/events') && Number(request.headers()['last-event-id']) > 0)
          reconnected = true;
      });
      await page.route('**/api/generations/*/events', async (route) => {
        if (dropped) return route.continue();
        dropped = true;
        const response = await fetch(route.request().url(), {
            headers: route.request().headers(),
            signal: AbortSignal.timeout(20000),
          }),
          reader = response.body!.getReader();
        let body = '';
        const decoder = new TextDecoder();
        try {
          while (!/id: ?[1-9]\d*\n/.test(body) || !body.includes('\n\n')) {
            const next = await reader.read();
            if (next.done) break;
            body += decoder.decode(next.value, { stream: true });
          }
          await route.fulfill({
            status: response.status,
            headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-store' },
            body: body.slice(0, body.indexOf('\n\n') + 2),
          });
        } finally {
          await reader.cancel().catch(() => {});
        }
      });
      try {
        if (input === 'pdf-recovery')
          await mock('scenario', { rules: [{ kind: 'chapter', number: '2', failure: '401' }] });
        projectId = await createFromUi(page, prefix + ' ' + input, input === 'pdf-recovery');
        record(prefix, [projectId]);
        if (input === 'pdf-recovery') {
          await expect(
            page.getByRole('button', { name: 'Lanjutkan penyusunan', exact: true }),
          ).toBeVisible({ timeout: 60000 });
          const partial = await document(page, projectId);
          expect(partial.sections.filter((s: any) => s.status !== 'pending')).toHaveLength(4);
          const first = page.locator('[id="section-1.1"]');
          await first.getByRole('button', { name: 'Edit', exact: true }).click();
          const editor = first.getByRole('textbox', { name: 'Markdown', exact: true });
          await editor.fill((await editor.inputValue()) + '\n\n' + marker);
          await first.getByRole('button', { name: 'Selesai mengedit', exact: true }).click();
          await expect(editor).toBeHidden();
          const checkpoint = (await document(page, projectId)).sections.filter((s: any) =>
            s.number.startsWith('1.'),
          );
          await mock('scenario', { rules: [] });
          await page.getByRole('button', { name: 'Lanjutkan penyusunan', exact: true }).click();
          await generated(page);
          const resumed = (await document(page, projectId)).sections.filter((section: any) =>
            section.number.startsWith('1.'),
          );
          expect(resumed.find((section: any) => section.id === '1.1')).toEqual(
            checkpoint.find((section: any) => section.id === '1.1'),
          );
          const content = (sections: any[]) =>
            sections.map(({ version, updatedAt, ...section }) => section);
          expect(content(resumed)).toEqual(content(checkpoint));
          expect(
            (await mock('requests')).requests.filter(
              (r: any) => r.kind === 'chapter' && r.number === '1',
            ),
          ).toHaveLength(1);
        } else {
          await generated(page);
          const first = page.locator('[id="section-1.1"]');
          await first.getByRole('button', { name: 'Edit', exact: true }).click();
          const editor = first.getByRole('textbox', { name: 'Markdown', exact: true });
          await editor.fill((await editor.inputValue()) + '\n\n' + marker);
          await first.getByRole('button', { name: 'Selesai mengedit', exact: true }).click();
          await expect(editor).toBeHidden();
        }
        expect(dropped).toBe(true);
        expect(reconnected).toBe(true);
        await page.reload();
        expect(
          (await document(page, projectId)).sections.find((s: any) => s.id === '1.1').markdown,
        ).toContain(marker);
        const revise = async (section: string, instruction: string) => {
          await page
            .locator('[id="section-' + section + '"]')
            .getByRole('button', { name: 'Revisi AI', exact: true })
            .click();
          await page.getByRole('dialog').getByRole('textbox').fill(instruction);
          await page.getByRole('button', { name: 'Kirim revisi', exact: true }).click();
          await expect(
            page.getByRole('heading', { name: 'Tinjau usulan revisi', exact: true }),
          ).toBeVisible({ timeout: 35000 });
        };
        const before = await document(page, projectId);
        await revise('3.2', acceptedMarker);
        expect(await document(page, projectId)).toEqual(before);
        await page.reload();
        await page.getByRole('button', { name: 'Terapkan perubahan', exact: true }).click();
        await expect(
          page.getByRole('heading', { name: 'Tinjau usulan revisi', exact: true }),
        ).toBeHidden();
        const revised = await document(page, projectId);
        expect(revised.sections.filter((s: any) => s.id !== '3.2')).toEqual(
          before.sections.filter((s: any) => s.id !== '3.2'),
        );
        expect(revised.sections.find((s: any) => s.id === '3.2').markdown).toContain(
          acceptedMarker,
        );
        await revise('1.2', 'Usulan ditolak ' + prefix);
        await page
          .getByRole('dialog')
          .getByRole('button', { name: 'Batalkan', exact: true })
          .click();
        await expect(
          page.getByRole('heading', { name: 'Tinjau usulan revisi', exact: true }),
        ).toBeHidden();
        expect(await document(page, projectId)).toEqual(revised);
        await page.getByRole('button', { name: 'Setujui dan finalisasi', exact: true }).click();
        await page.getByLabel('Saya telah meninjau dokumen ini').check();
        await page.getByRole('button', { name: 'Finalisasi dokumen', exact: true }).click();
        await expect(page).toHaveURL(/export\//);
        let next = page.waitForEvent('download');
        await page.getByRole('button', { name: 'Unduh dokumen Word', exact: true }).click();
        const word = await next,
          zip = unzipSync(new Uint8Array(await readFile((await word.path())!))),
          xml = strFromU8(zip['word/document.xml']!);
        expect(xml).toContain(marker);
        expect(xml).toContain(acceptedMarker);
        expect(xml).toContain('TOC');
        next = page.waitForEvent('download');
        await page.getByRole('button', { name: 'Simpan sebagai PDF', exact: true }).click();
        const pdf = await next,
          bytes = await readFile((await pdf.path())!);
        expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
        const extract = spawnSync(
          'docker',
          ['exec', '-i', 'naskah-compiler', 'pdftotext', '-', '-'],
          { input: bytes, windowsHide: true, encoding: 'utf8' },
        );
        expect(extract.status).toBe(0);
        expect(extract.stdout).toContain(marker);
        expect(extract.stdout).toContain(acceptedMarker);
        await page.goto('/evaluation?tab=expert');
        await page
          .getByRole('button', { name: 'Siapkan perbandingan dokumen', exact: true })
          .click();
        await page
          .getByRole('combobox', { name: 'Dokumen sistem', exact: true })
          .selectOption(projectId);
        await page.getByLabel('Nama kasus', { exact: true }).fill(prefix + ' frozen manuscript');
        await page
          .getByLabel('Baseline manusia (Markdown)', { exact: true })
          .fill(
            '# 1. Introduction\n\nB9 baseline sintetis. Sistem harus mencatat data pasien dan memeriksa audit akses.',
          );
        await page
          .getByLabel('Asal dan versi baseline', { exact: true })
          .fill('B9 synthetic baseline, explicitly dev data.');
        const created = page.waitForResponse(
          (r) => r.url().includes('/api/evaluation/cases?') && r.request().method() === 'POST',
        );
        await page.getByRole('button', { name: 'Simpan kasus', exact: true }).click();
        const c = await (await created).json();
        expect(c.projectId).toBe(projectId);
        caseId = c.id;
        for (const [person, score] of [
          ['one', 100],
          ['two', 50],
        ] as const) {
          if (person === 'two')
            await page.getByRole('button', { name: 'Ganti peserta', exact: true }).click();
          await page.getByLabel('Kode peserta', { exact: true }).fill(prefix + '_' + person);
          await page.getByLabel('Saya menyetujui penyimpanan jawaban untuk evaluasi ini.').check();
          await page.getByRole('button', { name: 'Mulai sesi peserta', exact: true }).click();
          await expect(
            page.getByText('Peserta ' + prefix + '_' + person, { exact: false }),
          ).toBeVisible();
          await expect(page.getByRole('heading', { name: 'Dokumen A', exact: true })).toBeVisible();
          const blinded = await (
            await page.request.get('/api/evaluation/blind?scope=dev&caseId=' + caseId)
          ).json();
          expect(blinded.some((d: any) => d.markdown.includes(marker))).toBe(true);
          expect(blinded.every((d: any) => !('source' in d))).toBe(true);
          for (const label of ['A', 'B']) {
            await page.getByRole('button', { name: 'Dokumen ' + label, exact: true }).click();
            for (const d of ['unambiguous', 'complete', 'correct', 'verifiable'])
              await page
                .getByRole('radio', {
                  name: label + '-' + d + ': ' + (person === 'one' ? 4 : 3),
                  exact: true,
                })
                .check();
            for (const box of await page.getByRole('textbox', { name: /Alasan/ }).all())
              await box.fill('B9_PRIVATE ' + prefix);
            await page.getByRole('button', { name: 'Kirim penilaian', exact: true }).click();
            await expect(
              page.getByRole('button', { name: 'Penilaian tersimpan', exact: true }),
            ).toBeDisabled();
          }
          await page.getByRole('tab', { name: 'SUS', exact: true }).click();
          await page
            .getByRole('combobox', { name: 'Dokumen sistem', exact: true })
            .selectOption(projectId);
          for (let i = 1; i <= 10; i++)
            await page
              .getByRole('radio', {
                name: 'SUS ' + i + ': ' + (person === 'one' ? (i % 2 ? 5 : 1) : 3),
                exact: true,
              })
              .check();
          await page.getByRole('button', { name: 'Kirim jawaban SUS', exact: true }).click();
          await expect(page.locator('.result-panel')).toContainText(score.toFixed(1) + ' / 100');
          await page.reload();
          await expect(page.locator('.result-panel')).toContainText(score.toFixed(1) + ' / 100');
          await page.getByRole('tab', { name: 'Penilaian pakar', exact: true }).click();
          await page
            .getByRole('combobox', { name: 'Kasus evaluasi', exact: true })
            .selectOption(caseId);
        }
        const computed = page.waitForResponse(
          (r) => r.url().includes('/api/evaluation/statistics?') && r.request().method() === 'POST',
        );
        await page.getByRole('button', { name: 'Hitung statistik', exact: true }).click();
        const stats = await (await computed).json();
        expect(stats.kind).toBe('statistics');
        digests.push(stats.provenance.input_digest);
        record(prefix, [], digests);
        await expect(
          page.getByText('Desain analisis: Berpasangan', { exact: false }),
        ).toBeVisible();
        await page.getByRole('tab', { name: 'BERTScore', exact: true }).click();
        await page
          .getByRole('combobox', { name: 'Kasus evaluasi', exact: true })
          .selectOption(caseId);
        await page.getByRole('button', { name: 'BERTScore', exact: true }).click();
        await expect(
          page.getByText(/^Precision .*Recall .*F1 /),
        ).toBeVisible({ timeout: 25000 });
        await expect(page.getByLabel('Kelompok data', { exact: true })).toBeEnabled();
        next = page.waitForEvent('download');
        await page.getByRole('link', { name: 'Ekspor JSON', exact: true }).click();
        const snapshot = JSON.parse(await readFile((await (await next).path())!, 'utf8'));
        expect(snapshot.stats_input.reviews.length).toBeGreaterThanOrEqual(4);
        expect(JSON.stringify(snapshot)).not.toContain(prefix);
        expect(JSON.stringify(snapshot)).not.toContain(projectId);
        expect(JSON.stringify(snapshot)).not.toContain('B9_PRIVATE');
        await page.setViewportSize({ width: 390, height: 844 });
        for (const tab of ['Ringkasan', 'Penilaian pakar', 'SUS', 'BERTScore']) {
          await page.getByRole('tab', { name: tab, exact: true }).click();
          expect(
            await page.evaluate(
              () => window.document.documentElement.scrollWidth <= window.innerWidth + 1,
            ),
            'Evaluation fits mobile: ' + tab,
          ).toBe(true);
        }
        await page.screenshot({
          path: 'artifacts/b9/' + info.project.name + '-' + input + '-evaluation-mobile.png',
          fullPage: true,
        });
        await page.getByLabel('Kelompok data', { exact: true }).selectOption('research');
        const research = await (
          await page.request.get('/api/evaluation/export?scope=research&format=json')
        ).json();
        expect(Object.values(research.datasets).flat()).toHaveLength(0);
        expect(
          network.filter(
            (url) => /^https?:/.test(url) && new URL(url).origin !== 'http://127.0.0.1:3000',
          ),
        ).toEqual([]);
      } finally {
        record(prefix, projectId ? [projectId] : [], digests);
        await mock('reset');
        await runtime('cleanup');
        await page.unrouteAll({ behavior: 'wait' });
      }
    },
  );
