import { randomBytes, randomUUID } from 'node:crypto';
import { supabase, setMissingEnv } from './lib/local.mjs';
const status=JSON.parse(supabase(['status','-o','json']));
setMissingEnv({
  APP_BASE_URL:'http://localhost:3000', APP_ENCRYPTION_KEY:randomBytes(32).toString('base64'),APP_KEY_VERSION:'1',LOCAL_OWNER_ID:randomUUID(),
  NEXT_PUBLIC_DATA_MODE:'mock',SUPABASE_URL:status.API_URL,SUPABASE_SERVICE_ROLE_KEY:status.SERVICE_ROLE_KEY,DATABASE_URL:status.DB_URL,
  N8N_BASE_URL:'http://localhost:5678',N8N_WEBHOOK_SECRET:randomBytes(32).toString('hex'),N8N_CALLBACK_SECRET:randomBytes(32).toString('hex'),
  N8N_INTERNAL_APP_URL:'http://host.docker.internal:3000',N8N_INTERNAL_SUPABASE_URL:'http://host.docker.internal:54321',
  COMPILER_SERVICE_URL:'http://localhost:8000',COMPILER_MODE:'server',ALLOW_LOCAL_PROVIDER_URLS:'true',ENABLE_DEVTOOLS:'false',
});
console.log('Missing local server configuration initialized. Existing values retained; secret values withheld.');
