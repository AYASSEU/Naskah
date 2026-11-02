import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 90000,
  expect: { timeout: 12000 },
  workers: 1,
  fullyParallel: false,
  reporter: 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000',
    channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge',
    headless: true,
    viewport: { width: 1440, height: 1000 },
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'dark', use: { colorScheme: 'dark' } },
    { name: 'light', use: { colorScheme: 'light' } },
  ],
});
