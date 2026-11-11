import { test, expect } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import {
  bootstrap,
  createFromUi,
  generated,
  hash,
  mock,
  record,
  freshPrefix,
  runtime,
  headers,
} from './b9-support';
test.skip(process.env.NASKAH_E2E_MODE !== 'live', 'Requires guarded local mock B9 services.');
test('live Settings creates, rotates, deletes and restores credentials used by generation', async ({
  page,
}, info) => {
  test.setTimeout(300000);
  page.setDefaultTimeout(25000);
  page.on('dialog', (d) => void d.accept());
  const prefix = freshPrefix(),
    projects: string[] = [],
    keys = [0, 1].map(() => 'naskah-test-b9-' + randomBytes(16).toString('hex'));
  await runtime('preflight');
  await bootstrap(page);
  await mock('reset');
  await page.addInitScript((theme) => localStorage.setItem('theme', theme), info.project.name);
  const before = await runtime('inspect');
  const state = await (await page.request.get('/api/settings/integrations/deepseek')).json();
  const save = async (key: string) => {
    const row = page.locator('#integration-deepseek');
    await expect(row).toBeVisible();
    if (await row.getByRole('button', { name: 'Ganti kunci', exact: true }).isVisible())
      await row.getByRole('button', { name: 'Ganti kunci', exact: true }).click();
    await row.locator('summary').click();
    await row.getByLabel('URL server', { exact: true }).fill(state.config.baseUrl);
    await row.getByLabel('Model', { exact: true }).fill(state.config.model);
    await row.locator('input[type=password]').fill(key);
    const saved = page.waitForResponse(
      (r) =>
        r.url().endsWith('/api/settings/integrations/deepseek') && r.request().method() === 'PUT',
    );
    await row.getByRole('button', { name: 'Simpan dan sambungkan', exact: true }).click();
    expect((await (await saved).text()).includes(key)).toBe(false);
    await expect(row.locator('.integration-state.ready')).toHaveCount(3, { timeout: 65000 });
    await expect(row.getByRole('button', { name: 'Ganti kunci', exact: true })).toBeVisible();
    expect((await page.content()).includes(key)).toBe(false);
    expect(await page.evaluate(() => JSON.stringify([localStorage, sessionStorage]))).not.toContain(
      key,
    );
  };
  const checkBinding = async () => {
    const result = await runtime('inspect');
    const credential = result.credentials.find((c: any) => c.name === 'naskah/deepseek');
    for (const name of ['Generate SRS', 'Revise Section']) {
      const workflow = result.workflows.find((w: any) => w.name === 'Naskah / ' + name);
      expect(workflow).toBeTruthy();
      const refs = workflow.nodes
        .flatMap((n: any) => Object.values(n.credentials ?? {}))
        .filter((r: any) => r.name === 'naskah/deepseek');
      expect(refs.length).toBeGreaterThan(0);
      expect(
        refs.every((r: any) => r.id === credential.id),
        'Main workflow must use the current credential',
      ).toBe(true);
    }
    return result;
  };
  const run = async (key: string, label: string) => {
    await mock('reset');
    const id = await createFromUi(page, prefix + ' ' + label);
    projects.push(id);
    record(prefix, [id]);
    await generated(page);
    const captures = (await mock('requests')).requests.filter((r: any) => r.kind === 'chapter');
    expect(captures.length).toBe(4);
    expect(
      captures.every((r: any) => r.keyHash === hash(key)),
      'Actual generation uses the selected key',
    ).toBe(true);
  };
  try {
    await page.goto('/settings');
    let row = page.locator('#integration-deepseek');
    await row.getByRole('button', { name: 'Hapus kunci', exact: true }).click();
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Hapus kunci', exact: true })
      .click();
    await expect(row.locator('.integration-state.ready')).toHaveCount(0);
    await page.goto('/new-project');
    await page.getByLabel('Nama dokumen', { exact: true }).fill(prefix + ' blocked');
    await page
      .getByRole('textbox', { name: 'Deskripsi sistem', exact: true })
      .fill('Synthetic blocked start.');
    await expect(
      page.getByRole('button', { name: 'Mulai buat dokumen SRS', exact: true }),
    ).toBeDisabled();
    const blocked = await (await page.request.get('/api/system/status')).json();
    expect(blocked.ready).toBe(false);
    expect(blocked.reasons.some((r: any) => r.integration === 'deepseek')).toBe(true);
    await page.goto('/settings');
    await save(keys[0]!);
    await checkBinding();
    console.log('B9 initial credential bound.');
    await run(keys[0]!, 'created');
    console.log('B9 initial credential generation passed.');
    await page.goto('/settings');
    await save(keys[1]!);
    await checkBinding();
    await run(keys[1]!, 'rotated');
    console.log('B9 rotated credential generation passed.');
    await page.goto('/settings');
    row = page.locator('#integration-deepseek');
    await row.getByRole('button', { name: 'Ganti kunci', exact: true }).click();
    await row.locator('input[type=password]').fill('invalid-b9-' + randomBytes(16).toString('hex'));
    await row.getByRole('button', { name: 'Simpan dan sambungkan', exact: true }).click();
    await expect(row.getByRole('alert')).toContainText('Kunci API ditolak');
    expect(
      (await (await page.request.get('/api/settings/integrations/deepseek')).json()).key_hint,
    ).toBe(keys[1]!.slice(-4));
    await page.reload();
    await runtime('reset-credentials');
    const reapplied = page.waitForResponse(
      (r) =>
        r.url().endsWith('/api/settings/integrations/reapply') && r.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Terapkan ulang sambungan', exact: true }).click();
    expect((await reapplied).ok()).toBe(true);
    await expect(page.locator('#integration-deepseek .integration-state.ready')).toHaveCount(3, {
      timeout: 65000,
    });
    const after = await checkBinding();
    expect(
      after.workflows.map((w: any) => ({
        id: w.id,
        nodes: w.nodes.map((n: any) => ({ id: n.id, position: n.position })),
      })),
    ).toEqual(
      before.workflows.map((w: any) => ({
        id: w.id,
        nodes: w.nodes.map((n: any) => ({ id: n.id, position: n.position })),
      })),
    );
    await run(keys[1]!, 'recovered');
    await runtime('scan');

    await page.goto('/settings');
    await expect(page.locator('#integration-deepseek .integration-state.ready')).toHaveCount(3);
    await page.screenshot({
      path: 'artifacts/b9/' + info.project.name + '-settings.png',
      fullPage: true,
    });
  } finally {
    for (const id of projects)
      await page.request.delete('/api/projects/' + id, { headers }).catch(() => {});
    await runtime('restore');
    await runtime('cleanup');
  }
});
