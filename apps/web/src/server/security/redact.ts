import 'server-only';
const sensitive = /api.?key|authorization|token|secret|password|ciphertext|^iv$|^tag$|raw.?text|markdown|prompt|content|before.?text|after.?text/i;
const registered = new Set<string>();
export function registerSecret(value: string) { if (value.length >= 8) registered.add(value); }
export function redact(value: unknown): unknown {
  if (typeof value === 'string') {
    let result = value.replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]').replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[REDACTED]');
    for (const secret of registered) result = result.split(secret).join('[REDACTED]');
    return result;
  }
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k,v]) => [k, sensitive.test(k) ? '[REDACTED]' : redact(v)]));
  return value;
}
export function logSafe(event: string, metadata: Record<string, unknown> = {}) {
  console.info(JSON.stringify({ event, metadata: redact(metadata) }));
}
