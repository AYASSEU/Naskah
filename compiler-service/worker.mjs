import { spawn } from 'node:child_process';
/** Each job owns a process group, including any LibreOffice descendants. */
export function worker(command, args, timeout, max = 4 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { detached: true, stdio: ['ignore', 'pipe', 'ignore'] }),
      chunks = [];
    let size = 0,
      settled = false;
    const killGroup = () => {
      try {
        process.kill(-child.pid, 'SIGKILL');
      } catch {}
    };
    // A parent can fail after spawning LibreOffice. Reap its remaining group
    // even when the parent exits before the deadline.
    child.once('exit', killGroup);
    const fail = (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        process.kill(-child.pid, 'SIGKILL');
      } catch {}
      reject(new Error(code));
    };
    const timer = setTimeout(() => fail('document_timeout'), timeout);
    child.on('error', () => fail('compiler_failed'));
    child.stdout.on('data', (data) => {
      size += data.length;
      if (size > max) fail('too_large');
      else chunks.push(data);
    });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const output = Buffer.concat(chunks).toString('utf8');
      if (code !== 0) {
        let parsed;
        try {
          parsed = JSON.parse(output);
        } catch {}
        reject(new Error(parsed?.error ?? 'compiler_failed'));
      } else resolve(output);
    });
  });
}
