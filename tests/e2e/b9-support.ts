import { expect, type Page } from '@playwright/test';
import { randomUUID, createHash } from 'node:crypto';
import { existsSync, mkdirSync, appendFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const base = 'http://127.0.0.1:3000';
if (existsSync('apps/web/.env.local')) process.loadEnvFile('apps/web/.env.local');
export const headers = { 'X-Naskah-Client': 'web', Origin: base };
export const freshPrefix = () => 'B9UI_' + randomUUID().slice(0, 8);
export const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export function record(prefix: string, projects: string[] = [], digests: string[] = []) {
  mkdirSync('artifacts/b9', { recursive: true });
  appendFileSync(
    'artifacts/b9/cleanup.jsonl',
    JSON.stringify({ prefix, projects, digests }) + '\n',
  );
}
export async function runtime(command: string): Promise<any> {
  const result = spawnSync(
    process.execPath,
    [
      '--conditions=react-server',
      '--env-file=apps/web/.env.local',
      '--import',
      'tsx',
      'scripts/b9-runtime.ts',
      command,
    ],
    {
      windowsHide: true,
      timeout: 90000,
      encoding: 'utf8',
      env: { ...process.env, TSX_TSCONFIG_PATH: 'apps/web/tsconfig.json' },
    },
  );
  if (result.error || result.status !== 0) throw new Error('B9 runtime failed: ' + command);
  console.log('B9 runtime ' + command + ' complete.');
  return command === 'inspect' ? JSON.parse(result.stdout) : undefined;
}
export async function mock(command: string, data: unknown = {}) {
  const r = await fetch('http://127.0.0.1:4010/__test/' + command, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + process.env.MOCK_CONTROL_TOKEN,
    },
    body: JSON.stringify(data),
  });
  expect(r.status, 'Local mock controller').toBe(200);
  return r.json();
}
export async function bootstrap(page: Page) {
  await page.request.get('/api/auth/session', { headers });
  const r = await page.request.get('/api/system/status');
  expect(r.ok()).toBeTruthy();
  const state = await r.json();
  expect(state.ready).toBe(true);
  for (const id of ['deepseek', 'embeddings'])
    expect(new URL(state.integrations.find((i: any) => i.id === id).config.baseUrl).port).toBe(
      '4010',
    );
}
export async function createFromUi(page: Page, title: string, files = false) {
  const ready = page.waitForResponse((r) => r.url().endsWith('/api/system/status'));
  await page.goto('/new-project');
  await ready;
  if (files) {
    await page
      .locator('input[type=file]')
      .setInputFiles(['tests/fixtures/documents/text.pdf', 'tests/fixtures/documents/notes.txt']);
    await expect(page.locator('.uploaded-file')).toHaveCount(2);
  }
  await page.getByLabel('Nama dokumen', { exact: true }).fill(title);
  await page
    .getByRole('textbox', { name: 'Deskripsi sistem', exact: true })
    .fill('Sistem harus mencatat data pasien. Petugas harus dapat memeriksa audit akses.');
  await expect(
    page.getByRole('button', { name: 'Mulai buat dokumen SRS', exact: true }),
  ).toBeEnabled();
  await page.getByRole('button', { name: 'Mulai buat dokumen SRS', exact: true }).click();
  await expect(page).toHaveURL(/workspace\//);
  return new URL(page.url()).pathname.split('/')[2]!;
}
export async function generated(page: Page) {
  await expect(
    page.getByRole('button', { name: 'Setujui dan finalisasi', exact: true }),
  ).toBeEnabled({ timeout: 70000 });
}
export async function document(page: Page, id: string) {
  const r = await page.request.get('/api/documents/' + id);
  expect(r.ok()).toBeTruthy();
  return r.json();
}
