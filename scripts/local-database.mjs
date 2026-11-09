import { supabase } from './lib/local.mjs';

const action = process.argv[2] ?? 'start';
if (!['start', 'stop'].includes(action)) {
  console.error('Gunakan: node scripts/local-database.mjs start|stop');
  process.exitCode = 1;
} else {
  try {
    const args =
      action === 'start'
        ? ['start', '--exclude', 'realtime,imgproxy,edge-runtime,logflare,vector,supavisor']
        : ['stop'];
    // CLI startup/status output can include keys. Only emit our own summary.
    supabase(args);
    console.log(action === 'start' ? 'Supabase lokal siap.' : 'Supabase lokal dihentikan.');
  } catch {
    console.error('Perintah Supabase gagal. Periksa Docker Desktop dan CLI lokal.');
    process.exitCode = 1;
  }
}
