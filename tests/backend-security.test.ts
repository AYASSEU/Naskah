import { describe, expect, it, vi } from 'vitest';
import { randomBytes } from 'node:crypto';
import { seal, unseal } from '@/server/security/envelope';
import { redact, registerSecret } from '@/server/security/redact';
import { isPrivateAddress, validateProviderUrl } from '@/server/security/urls';
import { constantTimeEqual } from '@/server/security/auth';
import { rateLimit } from '@/server/http/rate-limit';
import { ServerEnvSchema } from '@/server/config/env.server';
import envelopeVector from './fixtures/envelope.json';

describe('server security',()=>{
  it('reads the shared Python/Node envelope vector',()=>{
    expect(unseal(envelopeVector.envelope,envelopeVector.provider,envelopeVector.owner,{1:envelopeVector.key})).toBe(envelopeVector.plaintext);
  });
  it('encrypts with random nonces and binds ciphertext to provider, owner and key version',()=>{
    const key=randomBytes(32).toString('base64'),secret=randomBytes(24).toString('hex');
    const a=seal(secret,'deepseek','owner-a',key,2),b=seal(secret,'deepseek','owner-a',key,2);
    expect(a.iv).not.toBe(b.iv);expect(a.ciphertext).not.toContain(secret);
    expect(unseal(a,'deepseek','owner-a',{2:key})).toBe(secret);
    expect(()=>unseal(a,'embeddings','owner-a',{2:key})).toThrow();
    expect(()=>unseal(a,'deepseek','owner-b',{2:key})).toThrow();
    expect(()=>unseal(a,'deepseek','owner-a',{1:key})).toThrow('version');
    expect(()=>unseal({...a,tag:Buffer.alloc(16).toString('base64')},'deepseek','owner-a',{2:key})).toThrow();
  });
  it('redacts secrets recursively, including values embedded in error text',()=>{
    const key=randomBytes(32).toString('hex');registerSecret(key);
    const captured=JSON.stringify(redact({apiKey:key,nested:[{Authorization:`Bearer ${key}`}],error:`provider rejected ${key}`,raw_text:'private interview'}));
    expect(captured).not.toContain(key);expect(captured).not.toContain('private interview');
  });
  it('rejects private addresses, alternate loopback formats and DNS records',async()=>{
    for(const address of ['127.0.0.1','10.0.0.1','169.254.169.254','172.16.1.1','192.168.0.1','::1','fc00::1','fe80::1','::ffff:127.0.0.1','::ffff:7f00:1'])expect(isPrivateAddress(address)).toBe(true);
    expect(isPrivateAddress('8.8.8.8')).toBe(false);
    for(const url of ['http://example.com','https://user:pass@example.com','https://127.1','https://2130706433','https://[::1]'])await expect(validateProviderUrl(url,false)).rejects.toThrow();
    const resolver=vi.fn().mockResolvedValue([{address:'10.0.0.1',family:4}]);
    await expect(validateProviderUrl('https://example.com',false,resolver)).rejects.toThrow('invalid_provider_url');
    await expect(validateProviderUrl('http://localhost:4010',true)).resolves.toBeInstanceOf(URL);
  });
  it('bounds expensive calls and resets the window',()=>{
    rateLimit('test-owner','generate',1,100,0);
    expect(()=>rateLimit('test-owner','generate',1,100,1)).toThrow('rate_limited');
    expect(()=>rateLimit('test-owner','generate',1,100,101)).not.toThrow();
  });
  it('compares callback tokens without length-dependent exceptions',()=>{
    expect(constantTimeEqual('a','a')).toBe(true);expect(constantTimeEqual('a','longer')).toBe(false);
  });
  it('rejects missing server configuration without accepting public service keys',()=>{
    expect(ServerEnvSchema.safeParse({NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY:'invalid'}).success).toBe(false);
  });
});
