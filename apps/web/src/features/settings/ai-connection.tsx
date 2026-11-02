'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import {
  AiConnectionSaveSchema,
  type AiConnectionConfig,
  type AiConnectionSnapshot,
} from '@naskah/contracts';
import { PortError } from '@/services/ports';
import { useAsyncData, useServices } from '@/shared/lib/providers';
import { Button, Select } from '@/shared/ui';

export function AiConnectionSettings() {
  const t = useTranslations();
  const services = useServices();
  const { data, error, busy, refresh } = useAsyncData(
    () => services.aiConnection.getSettings(),
    [services],
  );
  return (
    <section className="settings-section" aria-labelledby="ai-settings-title">
      <h2 id="ai-settings-title">{t('aiSettings')}</h2>
      <div className="ai-settings-body">
        {busy ? (
          <p role="status">{t('aiLoading')}</p>
        ) : error ? (
          <div role="alert">
            <p className="inline-error">
              {t(error instanceof PortError ? error.userMessage : 'storageError')}
            </p>
            <Button onClick={() => void refresh()}>{t('retry')}</Button>
          </div>
        ) : data ? (
          <AiConnectionForm initial={data} />
        ) : null}
      </div>
    </section>
  );
}

function AiConnectionForm({ initial }: { initial: AiConnectionSnapshot }) {
  const t = useTranslations();
  const services = useServices();
  const [saved, setSaved] = useState(initial);
  const [config, setConfig] = useState<AiConnectionConfig>({
    provider: initial.provider,
    model: initial.model,
    baseUrl: initial.baseUrl,
  });
  const [apiKey, setApiKey] = useState('');
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState<'save' | 'test' | 'remove' | undefined>();
  const [validate, setValidate] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const dirty =
    config.provider !== saved.provider ||
    config.model !== saved.model ||
    config.baseUrl !== saved.baseUrl ||
    apiKey.length > 0;
  const parsed = AiConnectionSaveSchema.safeParse({ ...config, ...(apiKey ? { apiKey } : {}) });
  const invalid = (field: string) =>
    validate && !parsed.success && parsed.error.issues.some((issue) => issue.path[0] === field);
  function edit(next: Partial<AiConnectionConfig>) {
    setConfig({ ...config, ...next });
    setNotice('');
    setError('');
  }
  async function action(kind: 'save' | 'test' | 'remove') {
    setError('');
    setNotice('');
    if (kind === 'save' && !parsed.success) {
      setValidate(true);
      return;
    }
    setPending(kind);
    try {
      if (kind === 'test') {
        const result = await services.aiConnection.testConnection();
        setNotice(result.mode === 'mock' ? 'aiTestSimulated' : 'aiTestConnected');
      } else {
        const next =
          kind === 'save' && parsed.success
            ? await services.aiConnection.saveSettings(parsed.data)
            : await services.aiConnection.removeApiKey();
        setSaved(next);
        setApiKey('');
        setVisible(false);
        if (kind === 'save') {
          setConfig({ provider: next.provider, model: next.model, baseUrl: next.baseUrl });
          setValidate(false);
        }
        setNotice(
          kind === 'save' ? (services.mode === 'mock' ? 'aiSaved' : 'aiSavedLive') : 'aiKeyRemoved',
        );
      }
    } catch (cause) {
      setError(t(cause instanceof PortError ? cause.userMessage : 'storageError'));
    } finally {
      setPending(undefined);
    }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void action('save');
  }
  return (
    <form onSubmit={submit} noValidate>
      <p className="help-note ai-mode-note">
        {t(services.mode === 'mock' ? 'aiSimulationNote' : 'aiLiveNote')}
      </p>
      <fieldset disabled={!!pending} className="ai-settings-fields">
        <div className="field">
          <label htmlFor="ai-provider">{t('aiProvider')}</label>
          <Select
            id="ai-provider"
            label={t('aiProvider')}
            value={config.provider}
            onChange={(provider) => edit({ provider: provider as AiConnectionConfig['provider'] })}
            options={[
              { value: 'deepseek', label: 'DeepSeek' },
              { value: 'custom', label: t('aiCustomProvider') },
            ]}
          />
        </div>
        <div className="field">
          <label htmlFor="ai-model">{t('aiModel')}</label>
          <input
            id="ai-model"
            value={config.model}
            maxLength={128}
            autoComplete="off"
            onChange={(event) => edit({ model: event.target.value })}
            aria-invalid={invalid('model')}
            aria-describedby={invalid('model') ? 'ai-model-error' : undefined}
          />
          {invalid('model') && (
            <small id="ai-model-error" className="inline-error">
              {t('aiModelInvalid')}
            </small>
          )}
        </div>
        <div className="field">
          <label htmlFor="ai-endpoint">{t('aiEndpoint')}</label>
          <input
            id="ai-endpoint"
            type="url"
            value={config.baseUrl}
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => edit({ baseUrl: event.target.value })}
            aria-invalid={invalid('baseUrl')}
            aria-describedby={invalid('baseUrl') ? 'ai-endpoint-error' : 'ai-endpoint-hint'}
          />
          <small id="ai-endpoint-hint">{t('aiEndpointHint')}</small>
          {invalid('baseUrl') && (
            <small id="ai-endpoint-error" className="inline-error">
              {t('aiEndpointInvalid')}
            </small>
          )}
        </div>
        <div className="field">
          <label htmlFor="ai-api-key">{t('aiApiKey')}</label>
          <div className="ai-key-input">
            <input
              id="ai-api-key"
              type={visible ? 'text' : 'password'}
              value={apiKey}
              autoComplete="off"
              spellCheck={false}
              autoCapitalize="none"
              maxLength={512}
              placeholder={t(saved.hasApiKey ? 'aiKeyReplace' : 'aiKeyPlaceholder')}
              onChange={(event) => {
                setApiKey(event.target.value);
                setNotice('');
                setError('');
              }}
              aria-invalid={invalid('apiKey')}
              aria-describedby={`ai-key-hint ai-key-status${invalid('apiKey') ? ' ai-key-error' : ''}`}
            />
            <Button
              type="button"
              aria-controls="ai-api-key"
              aria-pressed={visible}
              onClick={() => setVisible(!visible)}
            >
              {t(visible ? 'aiHideKey' : 'aiShowKey')}
            </Button>
          </div>
          <small id="ai-key-hint">
            {t(saved.credentialStorage === 'memory' ? 'aiKeyPrivacy' : 'aiServerKeyPrivacy')}
          </small>
          {invalid('apiKey') && (
            <small id="ai-key-error" className="inline-error">
              {t('aiKeyInvalid')}
            </small>
          )}
        </div>
        <p id="ai-key-status" className="ai-key-status">
          {t(
            saved.hasApiKey
              ? saved.credentialStorage === 'memory'
                ? 'aiKeyPresent'
                : 'aiServerKeyPresent'
              : 'aiKeyAbsent',
          )}
        </p>
        <div className="ai-settings-actions">
          <Button type="submit" variant="primary" disabled={!dirty}>
            {t(pending === 'save' ? 'saving' : 'aiSave')}
          </Button>
          <Button
            type="button"
            disabled={dirty || !saved.hasApiKey}
            onClick={() => void action('test')}
          >
            {t(
              pending === 'test' ? 'aiTesting' : services.mode === 'mock' ? 'aiTest' : 'aiTestLive',
            )}
          </Button>
          {saved.hasApiKey && (
            <Button type="button" variant="text" onClick={() => void action('remove')}>
              {t('aiRemoveKey')}
            </Button>
          )}
        </div>
      </fieldset>
      {dirty && <p className="help-note ai-form-message">{t('aiUnsaved')}</p>}
      <div role="status" aria-live="polite" className="help-note ai-form-message">
        {notice && t(notice)}
      </div>
      {error && (
        <p role="alert" className="inline-error">
          {error}
        </p>
      )}
    </form>
  );
}
