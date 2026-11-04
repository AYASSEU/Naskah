export async function register() {
  if (
    process.env.NEXT_RUNTIME !== 'nodejs' ||
    process.env.NEXT_PUBLIC_DATA_MODE !== 'live' ||
    process.env.NEXT_PHASE === 'phase-production-build'
  )
    return;
  const { serverConfigured } = await import('./server/config/env.server');
  if (!serverConfigured()) return;
  const { startIntegrationDoctor } = await import('./server/integrations/doctor');
  await startIntegrationDoctor();
}
