import 'server-only';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { Agent, fetch as safeFetch } from 'undici';
import { AppError } from '../http/errors';

export function isPrivateAddress(raw: string): boolean {
  const ip = raw.toLowerCase().replace(/^\[|\]$/g,'');
  if (ip.includes(':')) {
    if (ip.startsWith('::ffff:')) {
      const tail = ip.slice(7);
      if (tail.includes('.')) return isPrivateAddress(tail);
      const words = tail.split(':');
      if (words.length===2) { const a=parseInt(words[0]!,16),b=parseInt(words[1]!,16); return isPrivateAddress(`${a>>8}.${a&255}.${b>>8}.${b&255}`); }
    }
    // Only global unicast 2000::/3, excluding documentation, Teredo and 6to4.
    return !/^[23][0-9a-f]{3}:/.test(ip) || /^(2001:(db8|0):|2002:)/.test(ip);
  }
  const parts=ip.split('.').map(Number), a=parts[0]!, b=parts[1]!;
  return !isIP(ip) || a===0 || a===10 || a===127 || a>=224 || (a===169&&b===254) || (a===172&&b>=16&&b<=31) || (a===192&&b===168) || (a===100&&b>=64&&b<=127) || (a===198&&(b===18||b===19)) || (a===192&&b===0) || (a===198&&b===51) || (a===203&&b===0);
}
export async function validateProviderUrl(raw: string, allowLocal: boolean, resolver = lookup): Promise<URL> {
  let u: URL; try {u=new URL(raw);} catch {throw new AppError('invalid_provider_url');}
  const host=u.hostname.toLowerCase().replace(/^\[|\]$/g,'');
  if (u.username||u.password||u.search||u.hash) throw new AppError('invalid_provider_url');
  if (allowLocal && ['localhost','127.0.0.1','::1','host.docker.internal'].includes(host) && ['http:','https:'].includes(u.protocol)) return u;
  if (u.protocol!=='https:') throw new AppError('invalid_provider_url');
  const addresses=isIP(host)?[{address:host}]:await resolver(host,{all:true}).catch(()=>{throw new AppError('provider_unreachable',502,true);});
  if (!addresses.length||addresses.some(a=>isPrivateAddress(a.address))) throw new AppError('invalid_provider_url');
  return u;
}
// Recheck before every request; redirects are forbidden to prevent credential forwarding.
export async function providerFetch(base: string, path: string, key: string, allowLocal: boolean, init: RequestInit = {}) {
  const u=await validateProviderUrl(base,allowLocal);
  const target=new URL(`${u.toString().replace(/\/$/,'')}/${path.replace(/^\//,'')}`);
  if(target.origin!==u.origin) throw new AppError('invalid_provider_url');
  const agent = new Agent({connect:{lookup(hostname,options,callback){
    lookup(hostname,{all:true}).then(addresses=>{
      const allowedLocal=allowLocal&&['localhost','127.0.0.1','::1','host.docker.internal'].includes(hostname);
      if(!addresses.length||(!allowedLocal&&addresses.some(a=>isPrivateAddress(a.address)))) {callback(new Error('invalid_provider_url'),'',4);return;}
      if(options.all) callback(null,addresses);
      else callback(null,addresses[0]!.address,addresses[0]!.family);
    }).catch(error=>callback(error,'',4));
  }}});
  try {
    const response=await safeFetch(target,{method:init.method,body:init.body as string|undefined,dispatcher:agent,redirect:'error',signal:init.signal??AbortSignal.timeout(20000),headers:{...Object.fromEntries(new Headers(init.headers)),Authorization:`Bearer ${key}`}});
    const reader=response.body?.getReader(),chunks:Uint8Array[]=[];let size=0;
    if(reader)try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>4*1024*1024){await reader.cancel();throw new AppError('provider_invalid_response',502);}chunks.push(value);}}finally{reader.releaseLock();}
    return new Response(Buffer.concat(chunks),{status:response.status,headers:Object.fromEntries(response.headers)});
  } finally {await agent.close();}
}
