import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { root, run, supabase } from './lib/local.mjs';
const status = JSON.parse(supabase(['status', '-o', 'json']));
run('docker', ['exec', '-i', 'supabase_db_naskah', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], {
  input: readFileSync(`${root}/supabase/tests/integrity.sql`, 'utf8'), safeOutput: true,
});
const tables = JSON.parse(run('docker', ['exec', 'supabase_db_naskah', 'psql', '-U', 'postgres', '-d', 'postgres', '-Atc',
  "select json_agg(tablename) from pg_tables where schemaname='public'"]));
const url = status.API_URL;
for (const table of tables) {
  for (const method of ['GET', 'POST']) {
    const response = await fetch(`${url}/rest/v1/${table}${method === 'GET' ? '?select=*&limit=1' : ''}`, {
      method, headers: { apikey: status.ANON_KEY, Authorization: `Bearer ${status.ANON_KEY}`, 'Content-Type': 'application/json' },
      ...(method === 'POST' ? { body: '{}' } : {}),
    });
    assert.ok([401, 403].includes(response.status), `anon ${method} unexpectedly allowed on ${table}: ${response.status}`);
  }
}
console.log(`Database integrity and anon read/write denial passed for ${tables.length} tables.`);
