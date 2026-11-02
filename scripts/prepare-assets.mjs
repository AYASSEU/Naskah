import { createRequire } from 'node:module';
import { copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
const require = createRequire(new URL('../apps/web/package.json', import.meta.url));
const worker = require.resolve('pdfjs-dist/build/pdf.worker.min.mjs');
await mkdir('apps/web/public', { recursive: true });
await copyFile(worker, 'apps/web/public/pdf.worker.min.mjs');
console.log(`PDF worker prepared: ${path.basename(worker)}`);
