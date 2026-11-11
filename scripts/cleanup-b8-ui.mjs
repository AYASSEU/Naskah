import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
process.loadEnvFile('apps/web/.env.local');
const require = createRequire(new URL('../apps/web/package.json', import.meta.url)),
  postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false, onnotice: () => {} });
try {
  if (existsSync('artifacts/b8/ui-cleanup.jsonl'))
    for (const line of readFileSync('artifacts/b8/ui-cleanup.jsonl', 'utf8')
      .split('\n')
      .filter(Boolean)) {
      const row = JSON.parse(line);
      if (!/^B8UI_[a-f0-9]{8}$/.test(row.code)) throw new Error('Unexpected cleanup code');
      await sql`delete from public.participants where owner_id=${process.env.LOCAL_OWNER_ID} and not is_thesis_run and code in (${row.code},${row.code + '_other'})`;
      if (row.digest && /^[a-f0-9]{64}$/.test(row.digest))
        await sql`delete from public.statistical_results where owner_id=${process.env.LOCAL_OWNER_ID} and not is_thesis_run and result->'provenance'->>'input_digest'=${row.digest}`;
      if (row.created && /^[0-9a-f-]{36}$/.test(row.projectId))
        await sql`delete from public.projects where id=${row.projectId} and owner_id=${process.env.LOCAL_OWNER_ID} and title='B8 synthetic evaluation'`;
    }
  console.log(
    'Removed only reserved synthetic B8 UI participant data and recorded test artifacts.',
  );
} finally {
  await sql.end();
}
