'use client';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useAsyncData, useServices } from '@/shared/lib/providers';
export function useSystemReadiness() {
  const services = useServices();
  const result = useAsyncData(
    () => services.integrations?.status() ?? Promise.resolve(null),
    [services],
  );
  return { ...result, ready: services.mode === 'mock' || result.data?.ready === true };
}
export function SystemStatus({ status }: { status: ReturnType<typeof useSystemReadiness> }) {
  const t = useTranslations();
  if (status.ready) return null;
  return (
    <div role="status" className="ai-mode-note">
      {status.busy ? (
        <p>{t('aiLoading')}</p>
      ) : status.error ? (
        <Link href="/settings">{t('backendErrors.integration_not_ready')}</Link>
      ) : (
        <ul>
          {status.data?.reasons
            .filter(
              (r, i, all) =>
                all.findIndex(
                  (other) => other.code === r.code && other.integration === r.integration,
                ) === i,
            )
            .map((r) => (
              <li key={`${r.integration}-${r.code}`}>
                <Link href={r.href}>{t(`backendErrors.${r.code}`)}</Link>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
