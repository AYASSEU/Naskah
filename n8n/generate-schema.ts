import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ChapterDraftSchema } from '../packages/contracts/src/index';

const require = createRequire(new URL('../packages/contracts/package.json', import.meta.url));
const { z } = require('zod') as typeof import('../packages/contracts/node_modules/zod');
const schema = z.toJSONSchema(ChapterDraftSchema, { io: 'input' });
const directory = fileURLToPath(new URL('./schemas', import.meta.url));
mkdirSync(directory, { recursive: true });
writeFileSync(
  fileURLToPath(new URL('./schemas/chapter-draft.json', import.meta.url)),
  JSON.stringify(schema, null, 2) + '\n',
);
console.log('Generated chapter validator schema from the shared Zod contract.');
