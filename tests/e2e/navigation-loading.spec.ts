import { test, expect } from '@playwright/test';
const transitions = [
  { from: '/', to: '/evaluation', name: 'Evaluasi', label: 'Memuat evaluasi…' },
  { from: '/evaluation', to: '/', name: 'Dokumen', label: 'Memuat dokumen…' },
];
for (const route of transitions) {
  test('loading feedback for ' + route.from + ' to ' + route.to, async ({ page }, info) => {
    await page.addInitScript((theme) => localStorage.setItem('theme', theme), info.project.name);
    let resume: () => void = () => {};
    const responseGate = new Promise<void>((resolve) => {
      resume = resolve;
    });
    await page.route(
      (url) => url.pathname === route.to,
      async (request) => {
        if (request.request().headers()['rsc'] === '1') await responseGate;
        await request.continue();
      },
    );
    await page.goto(route.from);
    const link = page.getByRole('link', { name: route.name, exact: true });
    const clicking = link.click();
    try {
      const loader = page.locator('.route-loading').first();
      await expect(loader).toBeVisible();
      await expect(loader).toContainText(route.label);
      await page.screenshot({ path: info.outputPath('navigation-loading.png') });
    } finally {
      resume();
    }
    await clicking;
    await expect(page).toHaveURL(route.to);
    await expect(page.locator('.route-loading')).toHaveCount(0);
  });
}
