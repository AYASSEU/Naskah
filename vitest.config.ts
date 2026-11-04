import { defineConfig } from 'vitest/config';
import path from 'node:path';
export default defineConfig({
  test: { include: ['tests/**/*.test.ts'] },
  resolve: {
    alias: {
      'server-only': path.resolve('tests/server-only.ts'),
      '@': path.resolve('apps/web/src'),
      '@naskah/contracts': path.resolve('packages/contracts/src/index.ts'),
    },
  },
});
