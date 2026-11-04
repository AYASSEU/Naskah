import { beforeAll,describe,expect,it } from 'vitest';
import { randomBytes,randomUUID } from 'node:crypto';
import { createSession,requireOwner,requireCallback,assertFresh } from '@/server/security/auth';
import { eventStream } from '@/server/http/sse';
beforeAll(()=>{
  Object.assign(process.env,{APP_BASE_URL:'http://localhost:3000',APP_ENCRYPTION_KEY:randomBytes(32).toString('base64'),LOCAL_OWNER_ID:randomUUID(),SUPABASE_URL:'http://localhost:54321',SUPABASE_SERVICE_ROLE_KEY:randomBytes(32).toString('hex'),DATABASE_URL:'postgres://localhost/test',N8N_WEBHOOK_SECRET:randomBytes(32).toString('hex'),N8N_CALLBACK_SECRET:randomBytes(32).toString('hex')});
});
describe('request guards',()=>{
  it('requires a signed cookie and rejects cross-origin session creation',()=>{
    const r=new Request('http://localhost:3000/api/auth/session',{headers:{'X-Naskah-Client':'web'}});
    expect(()=>requireOwner(r)).toThrow('unauthorized');
    const session=createSession(r);
    expect(requireOwner(new Request('http://localhost:3000/api/projects',{headers:{cookie:`naskah-owner=${session}`}}))).toBe(process.env.LOCAL_OWNER_ID);
    expect(()=>createSession(new Request(r,{headers:{'X-Naskah-Client':'web',origin:'https://evil.test'}}))).toThrow('cross_origin');
    expect(()=>createSession(new Request('http://evil.test:3000/api/auth/session',{headers:{'X-Naskah-Client':'web'}}))).toThrow('local_access');
    expect(()=>requireOwner(new Request('http://localhost:3000/api/projects',{headers:{cookie:`naskah-owner=${session}tampered`}}))).toThrow('unauthorized');
  });
  it('rejects unauthorized or stale callbacks',()=>{
    expect(()=>requireCallback(new Request('http://localhost:3000/api/webhooks/srs-ready'))).toThrow('unauthorized');
    expect(()=>requireCallback(new Request('http://localhost:3000/api/webhooks/srs-ready',{headers:{authorization:`Bearer ${process.env.N8N_CALLBACK_SECRET}`}}))).not.toThrow();
    expect(()=>assertFresh('invalid')).toThrow('stale_callback');
    expect(()=>assertFresh('2000-01-01T00:00:00Z')).toThrow('stale_callback');
  });
  it('matches the validated Host when Next normalizes the request URL',()=>{
    expect(()=>createSession(new Request('http://localhost:3000/api/auth/session',{headers:{host:'127.0.0.1:3000',origin:'http://127.0.0.1:3000','X-Naskah-Client':'web'}}))).not.toThrow();
    expect(()=>createSession(new Request('http://localhost:3000/api/auth/session',{headers:{host:'evil.test:3000',origin:'http://evil.test:3000','X-Naskah-Client':'web'}}))).toThrow('local_access_only');
  });
});
describe('SSE replay',()=>{
  it('resumes after the last acknowledged event and closes after terminal output',async()=>{
    const events=[{seq:1,type:'stage',payload:{type:'stage'}},{seq:2,type:'section_drafted',payload:{type:'section_drafted'}},{seq:3,type:'completed',payload:{type:'completed'}}];
    const response=eventStream(new Request('http://localhost/events'),1,async cursor=>events.filter(e=>e.seq>cursor));
    const body=await response.text();expect(body).not.toContain('id: 1');expect(body).toContain('id: 2');expect(body).toContain('id: 3');
  });
});
