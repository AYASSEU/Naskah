import { spawnSync } from 'node:child_process';

const probeOptions = { encoding: 'utf8', windowsHide: true, timeout: 10000 };

export function ensureDocker() {
  const ready = spawnSync('docker', ['info', '--format', '{{.ServerVersion}}'], probeOptions);
  if (ready.error?.code === 'ENOENT')
    throw new Error('Docker Desktop belum terpasang atau docker belum tersedia di PATH.');
  if (ready.status === 0) return;

  console.log('Menyalakan Docker Desktop. Menunggu engine siap…');
  const start = spawnSync('docker', ['desktop', 'start', '--timeout', '180'], {
    windowsHide: true,
    stdio: 'inherit',
    timeout: 190000,
  });
  if (start.error || start.status !== 0)
    throw new Error(
      'Docker Desktop gagal dimulai. Periksa Docker Desktop, lalu jalankan ulang aplikasi.',
    );

  const check = spawnSync('docker', ['info', '--format', '{{.ServerVersion}}'], probeOptions);
  if (check.error || check.status !== 0)
    throw new Error('Engine Docker belum siap. Periksa status Docker Desktop.');
}
