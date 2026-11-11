import { spawn } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
const secrets = [];
if (existsSync('apps/web/.env.local'))
  for (const line of readFileSync('apps/web/.env.local', 'utf8').split(/\r?\n/)) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line);
    if (match && /KEY|TOKEN|SECRET|DATABASE_URL/.test(match[1]) && match[2].length >= 20)
      secrets.push(match[2]);
  }
const redact = (text) => {
  for (const secret of secrets) text = text.replaceAll(secret, '[REDACTED]');
  return text
    .replace(/naskah-(?:owner|evaluation-(?:dev|research))=[A-Za-z0-9_.-]+/g, '[REDACTED-SESSION]')
    .replace(/naskah-test-b9-[a-f0-9]{32}/g, '[REDACTED-MOCK-KEY]')
    .replace(/github_pat_[A-Za-z0-9_]+/g, '[REDACTED]');
};
const child = spawn(
  process.execPath,
  ['node_modules/@playwright/test/cli.js', 'test', ...process.argv.slice(2)],
  { windowsHide: true, stdio: ['inherit', 'pipe', 'pipe'] },
);
for (const stream of [child.stdout, child.stderr]) {
  let pending = '';
  stream.setEncoding('utf8');
  stream.on('data', (chunk) => {
    pending += chunk;
    let end;
    while ((end = pending.indexOf('\n')) >= 0) {
      process.stdout.write(redact(pending.slice(0, end + 1)));
      pending = pending.slice(end + 1);
    }
  });
  stream.on('end', () => {
    if (pending) process.stdout.write(redact(pending));
  });
}
child.on('error', () => {
  console.error('UI test runner unavailable.');
  process.exitCode = 1;
});
child.on('close', (code) => {
  process.exitCode = code ?? 1;
});
