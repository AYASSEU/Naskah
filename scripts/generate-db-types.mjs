import { mkdirSync,writeFileSync } from 'node:fs';
import { root,supabase } from './lib/local.mjs';
const types=supabase(['gen','types','--lang','typescript','--schema','public']);
if(!types.includes('export type Database'))throw new Error('Unexpected type-generator output');
mkdirSync(`${root}/apps/web/src/server/db`,{recursive:true});
writeFileSync(`${root}/apps/web/src/server/db/types.ts`,types);
console.log('Database types generated from the running local schema.');
