'use client';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useTranslations } from 'next-intl';
import { Moon, Sun, Settings, BookOpen, FlaskConical, ChevronRight, Monitor } from 'lucide-react';
import { BRAND } from '@/shared/config/brand';
import { usePreferences } from '@/shared/lib/ui-store';
import { Devtools } from '@/features/devtools';
import { getEnvironment } from '@/shared/config/env';
export { Providers } from '@/shared/lib/providers';
export function Logo() {
  return (
    <Link href="/" className="brand" aria-label={BRAND.name}>
      <svg viewBox="0 0 28 30" width="25" height="28" fill="none" aria-hidden="true">
        <path d="M5 25V5h4l10 15V5h4v20h-4L9 10v15H5Z" fill="currentColor" />
        <path d="M3 28h22" stroke="currentColor" strokeWidth="1.5" />
      </svg>
      <span>{BRAND.name}</span>
    </Link>
  );
}
export function Shell({
  children,
  liveConfigured = false,
}: {
  children: React.ReactNode;
  liveConfigured?: boolean;
}) {
  const t = useTranslations();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const path = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const locale = usePreferences((s) => s.locale);
  const setLocale = usePreferences((s) => s.setLocale);
  const workspace = path.startsWith('/workspace');
  const print = path.endsWith('/print');
  if (print) return <>{children}</>;
  return (
    <>
      <header className="topbar">
        <div className="brand-group">
          <Logo />
          <span className="header-separator" />
          <span className="breadcrumb">
            {t(
              workspace
                ? 'documents'
                : path.startsWith('/evaluation')
                  ? 'evaluation'
                  : path.startsWith('/settings')
                    ? 'settings'
                    : path === '/new-project'
                      ? 'newProject'
                      : 'documents',
            )}
          </span>
        </div>
        <nav className="main-nav" aria-label={t('documents')}>
          <Link
            href="/"
            className={path === '/' || workspace || path.startsWith('/export') ? 'active' : ''}
          >
            <BookOpen />
            {t('documents')}
          </Link>
          <Link href="/evaluation" className={path.startsWith('/evaluation') ? 'active' : ''}>
            <FlaskConical />
            {t('evaluation')}
          </Link>
        </nav>
        <div className="header-actions">
          <button
            className="locale-button"
            onClick={() => setLocale(locale === 'id' ? 'en' : 'id')}
            aria-label={t('language')}
          >
            {locale.toUpperCase()}
            <ChevronRight />
          </button>
          <span className="header-separator" />
          <button
            className="icon-button"
            aria-label={t('theme')}
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
          >
            {mounted && resolvedTheme === 'dark' ? <Sun /> : <Moon />}
          </button>
          <Link
            href="/settings"
            className={`icon-button ${path.startsWith('/settings') ? 'selected' : ''}`}
            aria-label={t('settings')}
          >
            <Settings />
          </Link>
        </div>
      </header>
      {getEnvironment().mode === 'live' && !liveConfigured ? (
        <div className="error-state">
          <Monitor />
          <h1>{t('configError')}</h1>
          <p>{t('configDescription')}</p>
        </div>
      ) : (
        children
      )}
      {!workspace && (
        <footer className="footer">
          <span>
            <span className="small-square" />
            {t('localNote')}
          </span>
          <span>
            {t('simulation')}
            <span className="footer-slash">/</span>
            {t('standard')}
          </span>
        </footer>
      )}
      <Devtools />
    </>
  );
}
