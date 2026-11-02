'use client';
import { useState } from 'react';
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { usePreferences } from '@/shared/lib/ui-store';
import { useServices, useToast } from '@/shared/lib/providers';
import { appEvents } from '@/shared/lib/events';
import { flags } from '@/shared/config/flags';
import { Button, Toggle, Select } from '@/shared/ui';
import { AiConnectionSettings } from './ai-connection';
export function Settings() {
  const t = useTranslations();
  const { theme, setTheme } = useTheme();
  const locale = usePreferences((s) => s.locale);
  const setLocale = usePreferences((s) => s.setLocale);
  const paper = usePreferences((s) => s.paper);
  const setPaper = usePreferences((s) => s.setPaper);
  const research = usePreferences((s) => s.research);
  const setResearch = usePreferences((s) => s.setResearch);
  const services = useServices();
  const toast = useToast();
  const [error, setError] = useState('');
  const [resetVersion, setResetVersion] = useState(0);
  async function reset() {
    try {
      await services.reset();
      setResetVersion((value) => value + 1);
      sessionStorage.removeItem('naskah-intake');
      toast(t('saved'));
    } catch {
      setError(t('storageError'));
    }
  }
  return (
    <main className="page settings-page">
      <div className="page-heading">
        <div>
          <h1>{t('settingsTitle')}</h1>
          <p>{t('localNote')}</p>
        </div>
      </div>
      <section className="settings-section">
        <h2>{t('appearance')}</h2>
        <div>
          <div className="setting-row">
            <div>
              <label>{t('theme')}</label>
            </div>
            <Select
              label={t('theme')}
              value={theme || 'system'}
              onChange={setTheme}
              options={['system', 'light', 'dark'].map((v) => ({ value: v, label: t(v) }))}
            />
          </div>
          <div className="setting-row">
            <div>
              <label>{t('language')}</label>
            </div>
            <Select
              label={t('language')}
              value={locale}
              onChange={(v) => setLocale(v as 'id' | 'en')}
              options={[
                { value: 'id', label: 'Bahasa Indonesia' },
                { value: 'en', label: 'English' },
              ]}
            />
          </div>
          <div className="setting-row">
            <div>
              <label>{t('sheet')}</label>
              <p>{t('sheetDescription')}</p>
            </div>
            <Toggle label={t('sheet')} checked={paper} onChange={setPaper} />
          </div>
        </div>
      </section>
      <AiConnectionSettings key={resetVersion} />
      <section className="settings-section">
        <h2>{t('research')}</h2>
        <div className="setting-row">
          <div>
            <label>{t('research')}</label>
            <p>{t('researchDescription')}</p>
          </div>
          <Toggle checked={research} onChange={setResearch} label={t('research')} />
        </div>
      </section>
      <section className="settings-section">
        <h2>{t('data')}</h2>
        <div>
          <p className="help-note">{t('dataDescription')}</p>
          <p className="help-note" style={{ margin: '15px 0 25px' }}>
            {t('simulation')}: <code>{services.mode}</code>
          </p>
          <AlertDialog.Root>
            <AlertDialog.Trigger asChild>
              <Button className="danger">{t('reset')}</Button>
            </AlertDialog.Trigger>
            <AlertDialog.Portal>
              <AlertDialog.Overlay className="modal-overlay" />
              <AlertDialog.Content className="modal">
                <AlertDialog.Title>{t('resetTitle')}</AlertDialog.Title>
                <AlertDialog.Description
                  style={{ marginTop: 20, color: 'var(--ink-3)', fontSize: 12 }}
                >
                  {t('resetDescription')}
                </AlertDialog.Description>
                <div className="modal-actions">
                  <AlertDialog.Cancel asChild>
                    <Button>{t('cancel')}</Button>
                  </AlertDialog.Cancel>
                  <AlertDialog.Action asChild>
                    <Button variant="primary" onClick={() => void reset()}>
                      {t('reset')}
                    </Button>
                  </AlertDialog.Action>
                </div>
              </AlertDialog.Content>
            </AlertDialog.Portal>
          </AlertDialog.Root>
          {error && <p className="inline-error">{error}</p>}
        </div>
      </section>
      {flags.devtools && (
        <section className="settings-section">
          <h2>{t('developer')}</h2>
          <div>
            <Button onClick={() => appEvents.emit('devtools', undefined)}>{t('developer')}</Button>
            <p className="help-note" style={{ marginTop: 10 }}>
              Ctrl + Shift + D
            </p>
          </div>
        </section>
      )}
    </main>
  );
}
