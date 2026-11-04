import {diagnose} from '../apps/web/src/server/integrations/doctor';
import {sql} from '../apps/web/src/server/db/client';
try{const report=await diagnose();console.log(JSON.stringify(report,null,2));process.exitCode=report.ready?0:1;}
catch{console.error('Local services unavailable. Start Docker, Supabase and n8n; check .env.local.');process.exitCode=1;}
finally{await sql().end();}
