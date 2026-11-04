import 'server-only';
import { z } from 'zod';
import { requireOwner } from '../security/auth';
import { AppError, errorResponse } from './errors';
import { rateLimit } from './rate-limit';
export async function ownerRoute(request: Request, action: (owner: string)=>Promise<Response>, expensive?: string) {
  try {const owner=requireOwner(request);if(expensive)rateLimit(owner,expensive);return await action(owner);} catch(error) {return errorResponse(error);}
}
export async function readJson<T>(request: Request, schema: z.ZodType<T>, limit=2*1024*1024): Promise<T> {
  if(!request.headers.get('content-type')?.startsWith('application/json')) throw new AppError('invalid_input',415);
  if(Number(request.headers.get('content-length')??0)>limit) throw new AppError('too_large',413);
  if(!request.body) throw new AppError('invalid_input');
  const reader=request.body.getReader(),chunks:Uint8Array[]=[];let size=0;
  try {while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();throw new AppError('too_large',413);}chunks.push(value);}}
  finally {reader.releaseLock();}
  let json: unknown;try {json=JSON.parse(Buffer.concat(chunks).toString('utf8'));} catch{throw new AppError('invalid_input');}
  return schema.parse(json);
}
export function json(data: unknown, status=200) { return Response.json(data,{status,headers:{'Cache-Control':'no-store'}}); }
