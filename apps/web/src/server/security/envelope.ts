import 'server-only';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export interface Envelope { ciphertext: string; iv: string; tag: string; key_version: number; key_hint: string }
export const associatedData = (provider: string, ownerId: string) => Buffer.from(JSON.stringify([provider, ownerId]), 'utf8');
function decodeKey(key: string) {
  const bytes = Buffer.from(key, 'base64');
  if (bytes.length !== 32) throw new Error('invalid_encryption_key');
  return bytes;
}
export function seal(secret: string, provider: string, ownerId: string, key: string, version = 1): Envelope {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', decodeKey(key), iv);
  cipher.setAAD(associatedData(provider, ownerId));
  const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return { ciphertext: ciphertext.toString('base64'), iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), key_version: version, key_hint: secret.slice(-4) };
}
export function unseal(envelope: Envelope, provider: string, ownerId: string, keys: Record<number, string>) {
  const key = keys[envelope.key_version];
  if (!key) throw new Error('encryption_key_version_missing');
  const iv = Buffer.from(envelope.iv, 'base64'), tag = Buffer.from(envelope.tag, 'base64');
  if (iv.length !== 12 || tag.length !== 16) throw new Error('invalid_envelope');
  const decipher = createDecipheriv('aes-256-gcm', decodeKey(key), iv);
  decipher.setAAD(associatedData(provider, ownerId));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, 'base64')), decipher.final()]).toString('utf8');
}
