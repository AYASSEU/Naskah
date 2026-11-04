import 'server-only';
import { env } from '../config/env.server';
import { systemStatus } from './status';
import { audit } from './store';
import { repairMissingCredentials } from './credential-sync';
import { logSafe } from '../security/redact';
export async function diagnose() {
  const status = await systemStatus(env().LOCAL_OWNER_ID);
  return {
    ready: status.ready,
    reasons: status.reasons,
    workflows: status.workflows,
    knowledge: status.knowledge,
  };
}
export async function startIntegrationDoctor() {
  const check = async () => {
    try {
      const result = await diagnose();
      await audit(env().LOCAL_OWNER_ID, 'doctor_checked', 'integrations', {
        ready: result.ready,
        issues: result.reasons.length,
      });
    } catch {
      logSafe('doctor_failed', { code: 'n8n_unreachable' });
    }
  };
  try {
    await repairMissingCredentials(env().LOCAL_OWNER_ID);
  } catch {
    logSafe('credential_recovery_pending', { code: 'stored_but_not_synced' });
  }
  await check();
  const timer = setInterval(() => void check(), 3600000);
  timer.unref();
}
