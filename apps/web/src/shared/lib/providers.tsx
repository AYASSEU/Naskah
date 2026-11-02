'use client';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { NextIntlClientProvider, useTranslations } from 'next-intl';
import { ThemeProvider } from 'next-themes';
import { services } from '@/services/registry';
import type { Services } from '@/services/ports';
import { PortError } from '@/services/ports';
import { usePreferences } from './ui-store';
import id from '../i18n/messages/id.json';
import en from '../i18n/messages/en.json';
const ServiceContext = createContext<Services>(services);
const ToastContext = createContext<(message: string) => void>(() => {});
export const useServices = () => useContext(ServiceContext);
export const useToast = () => useContext(ToastContext);
export function Providers({ children }: { children: React.ReactNode }) {
  const locale = usePreferences((s) => s.locale);
  const [toast, setToast] = useState('');
  useEffect(() => {
    void usePreferences.persist.rehydrate();
  }, []);
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  return (
    <ThemeProvider attribute="data-theme" defaultTheme="system" enableSystem>
      <NextIntlClientProvider
        locale={locale}
        messages={locale === 'id' ? id : en}
        timeZone="Asia/Jakarta"
      >
        <ServiceContext.Provider value={services}>
          <ToastContext.Provider value={setToast}>
            {children}
            <div role="status" aria-live="polite" className={`toast ${toast ? 'visible' : ''}`}>
              {toast}
            </div>
          </ToastContext.Provider>
        </ServiceContext.Provider>
      </NextIntlClientProvider>
    </ThemeProvider>
  );
}
export function useAsyncData<T>(load: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(true);
  const refresh = useCallback(async () => {
    try {
      setError(undefined);
      setData(await load());
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }, deps);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return { data, error, busy, refresh, setData };
}
export function ErrorState({ error, retry }: { error: unknown; retry?: () => void }) {
  const t = useTranslations();
  return (
    <div className="error-state">
      <h2>{t('errorTitle')}</h2>
      <p>{t(error instanceof PortError ? error.userMessage : 'storageError')}</p>
      {retry && (
        <button className="button secondary" onClick={retry}>
          {t('retry')}
        </button>
      )}
      <a className="text-link" href="/">
        {t('goHome')}
      </a>
    </div>
  );
}
export function Loading() {
  const t = useTranslations();
  return (
    <div className="loading-state" role="status">
      <span>{t('loading')}</span>
      <div className="skeleton-line" />
      <div className="skeleton-line short" />
      <div className="skeleton-line" />
    </div>
  );
}
