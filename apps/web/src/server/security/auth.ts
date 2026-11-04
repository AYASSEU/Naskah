import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '../config/env.server';
import { AppError } from '../http/errors';

export const sessionCookie = 'naskah-owner';
export function constantTimeEqual(a: string, b: string) {
  const hash=(v:string)=>createHmac('sha256','naskah-comparison').update(v).digest();
  return timingSafeEqual(hash(a),hash(b));
}
function sign(payload: string) { return createHmac('sha256',Buffer.from(env().APP_ENCRYPTION_KEY,'base64')).update(`session:${payload}`).digest('base64url'); }
export function assertLocalRequest(request: Request) {
  const configured=new URL(env().APP_BASE_URL), actual=new URL(request.url);
  // Next can normalize request.url to localhost while the browser uses 127.0.0.1.
  // Validate the actual Host authority as well; never trust forwarded headers here.
  let browserUrl:URL;try{browserUrl=new URL(`${actual.protocol}//${request.headers.get('host')??actual.host}`);}catch{throw new AppError('local_access_only',403);}
  const local=new Set(['localhost','127.0.0.1','[::1]']);
  if(!local.has(configured.hostname)||!local.has(actual.hostname)||!local.has(browserUrl.hostname)||actual.port!==configured.port||browserUrl.port!==configured.port) throw new AppError('local_access_only',403);
  const origin=request.headers.get('origin');
  if(origin && origin!==browserUrl.origin) throw new AppError('cross_origin_request',403);
  const site=request.headers.get('sec-fetch-site');
  if(site && !['same-origin','none'].includes(site)) throw new AppError('cross_origin_request',403);
  if(!['GET','HEAD'].includes(request.method) && !origin && request.headers.get('x-naskah-client')!=='web') throw new AppError('cross_origin_request',403);
}
export function createSession(request: Request) {
  assertLocalRequest(request);
  if(request.headers.get('x-naskah-client')!=='web') throw new AppError('unauthorized',401);
  const payload=Buffer.from(JSON.stringify({owner:env().LOCAL_OWNER_ID,expires:Date.now()+12*3600000})).toString('base64url');
  return `${payload}.${sign(payload)}`;
}
export function requireOwner(request: Request) {
  assertLocalRequest(request);
  const token=request.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(`${sessionCookie}=`))?.slice(sessionCookie.length+1);
  if(!token) throw new AppError('unauthorized',401);
  const [payload,signature]=token.split('.');
  if(!payload||!signature||!constantTimeEqual(signature,sign(payload))) throw new AppError('unauthorized',401);
  try {
    const data=JSON.parse(Buffer.from(payload,'base64url').toString('utf8')) as {owner:string;expires:number};
    if(data.owner!==env().LOCAL_OWNER_ID||data.expires<Date.now()||!Number.isFinite(data.expires)) throw new Error();
    return data.owner;
  } catch {throw new AppError('unauthorized',401);}
}
export function requireCallback(request: Request) {
  if(!constantTimeEqual(request.headers.get('authorization')??'',`Bearer ${env().N8N_CALLBACK_SECRET}`)) throw new AppError('unauthorized',401);
}
export function assertFresh(timestamp: string) {
  const ms=Date.parse(timestamp);
  if(!Number.isFinite(ms)||Math.abs(Date.now()-ms)>5*60*1000) throw new AppError('stale_callback',401);
}
