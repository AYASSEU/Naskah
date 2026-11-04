import { createSession,sessionCookie } from '@/server/security/auth';
import { env } from '@/server/config/env.server';
import { errorResponse } from '@/server/http/errors';
export async function GET(request:Request){
  try{
    const token=createSession(request);
    return Response.json({id:env().LOCAL_OWNER_ID,name:'Local author'},{headers:{'Cache-Control':'no-store','Set-Cookie':`${sessionCookie}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${new URL(request.url).protocol==='https:'?'; Secure':''}`}});
  }catch(error){return errorResponse(error);}
}
