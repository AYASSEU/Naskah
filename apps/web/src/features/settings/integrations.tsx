'use client';
import { useEffect, useState } from 'react';
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { useTranslations } from 'next-intl';
import type { IntegrationState } from '@naskah/contracts';
import { useAsyncData, useServices } from '@/shared/lib/providers';
import { PortError } from '@/services/ports';
import { Button, Select } from '@/shared/ui';

function IntegrationRow({
  initial,
  refresh,
}: {
  initial: IntegrationState;
  refresh: () => Promise<void>;
}) {
  const t = useTranslations(),
    api = useServices().integrations!;
  const [state, setState] = useState(initial),
    [config, setConfig] = useState(initial.config),
    [key, setKey] = useState(''),
    [show, setShow] = useState(false),
    [changing, setChanging] = useState(!initial.configured),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    setState(initial);
  }, [initial]);
  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => {
      void api
        .get(initial.id)
        .then(setState)
        .catch(() => {});
    }, 700);
    return () => clearInterval(timer);
  }, [api, busy, initial.id]);
  async function act(kind: 'save' | 'test' | 'remove') {
    setBusy(true);
    setError('');
    try {
      const result =
        kind === 'save'
          ? await api.save(state.id, { ...config, ...(key ? { apiKey: key } : {}) })
          : kind === 'test'
            ? await api.test(state.id)
            : await api.remove(state.id);
      setState(result);
      setKey('');
      setChanging(!result.configured);
      await refresh();
    } catch (e) {
      setError(t(e instanceof PortError ? e.userMessage : 'backendErrors.unknown'));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="integration-row" id={`integration-${state.id}`}>
      <div className="integration-heading">
        <h3>{state.label}</h3>
        <div className="integration-states" aria-label={t('integrations.connectionStatus')}>
          {(['stored', 'synced', 'tested'] as const).map((step) => (
            <span
              key={step}
              className={state[step] ? 'integration-state ready' : 'integration-state'}
            >
              <span aria-hidden="true">{state[step] ? '✓' : '○'}</span> {t(`integrations.${step}`)}
            </span>
          ))}
        </div>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void act('save');
        }}
      >
        <div className="integration-key-row">
          <label htmlFor={`key-${state.id}`}>{t('integrations.apiKey')}</label>
          {changing ? (
            <div className="integration-key-input">
              <input
                id={`key-${state.id}`}
                type={show ? 'text' : 'password'}
                autoComplete="off"
                spellCheck={false}
                value={key}
                onChange={(e) => setKey(e.target.value)}
                disabled={busy}
              />
              <Button type="button" variant="text" onClick={() => setShow((v) => !v)}>
                {t(show ? 'integrations.hide' : 'integrations.show')}
              </Button>
            </div>
          ) : (
            <div className="integration-key-input">
              <span className="mono">•••• {state.key_hint}</span>
              <Button type="button" variant="text" onClick={() => setChanging(true)}>
                {t('integrations.changeKey')}
              </Button>
            </div>
          )}
        </div>
        <details className="integration-advanced">
          <summary>{t('integrations.advanced')}</summary>
          {state.id !== 'n8n' && (
            <label>
              {t('aiProvider')}
              <Select
                label={t('aiProvider')}
                value={config.preset}
                onChange={(preset) =>
                  setConfig((v) => ({ ...v, preset: preset as typeof config.preset }))
                }
                options={[
                  { value: 'custom', label: t('integrations.custom') },
                  ...(state.id === 'deepseek'
                    ? [{ value: 'deepseek', label: 'DeepSeek' }]
                    : [{ value: 'openai', label: 'OpenAI' }]),
                ]}
              />
            </label>
          )}
          <label>
            {t('integrations.baseUrl')}
            <input
              value={config.baseUrl}
              onChange={(e) => setConfig((v) => ({ ...v, baseUrl: e.target.value }))}
            />
          </label>
          {state.id !== 'n8n' && (
            <label>
              {t('aiModel')}
              <input
                value={config.model}
                onChange={(e) => setConfig((v) => ({ ...v, model: e.target.value }))}
              />
            </label>
          )}
          {state.id === 'embeddings' && (
            <label>
              {t('integrations.dimensions')}
              <input
                type="number"
                value={config.dimensions}
                onChange={(e) => setConfig((v) => ({ ...v, dimensions: Number(e.target.value) }))}
              />
            </label>
          )}
        </details>
        <div className="integration-actions">
          <Button variant="primary" type="submit" disabled={busy || (!state.configured && !key)}>
            {t('integrations.save')}
          </Button>
          <Button
            type="button"
            disabled={busy || !state.configured}
            onClick={() => void act('test')}
          >
            {t('integrations.test')}
          </Button>
          <AlertDialog.Root>
            <AlertDialog.Trigger asChild>
              <Button type="button" disabled={busy || !state.configured}>
                {t('integrations.remove')}
              </Button>
            </AlertDialog.Trigger>
            <AlertDialog.Portal>
              <AlertDialog.Overlay className="modal-overlay" />
              <AlertDialog.Content className="modal">
                <AlertDialog.Title>{t('integrations.remove')}</AlertDialog.Title>
                <AlertDialog.Description>
                  {t('integrations.removeDescription')}
                </AlertDialog.Description>
                <div className="modal-actions">
                  <AlertDialog.Cancel asChild>
                    <Button>{t('cancel')}</Button>
                  </AlertDialog.Cancel>
                  <AlertDialog.Action asChild>
                    <Button onClick={() => void act('remove')}>{t('integrations.remove')}</Button>
                  </AlertDialog.Action>
                </div>
              </AlertDialog.Content>
            </AlertDialog.Portal>
          </AlertDialog.Root>
        </div>
      </form>
      {busy && (
        <p role="status" className="help-note">
          {t(`integrations.step_${state.step || 'validate'}`)}
        </p>
      )}
      {(error || state.error_code) && (
        <p role="alert" className="inline-error">
          {error || t(`backendErrors.${state.error_code}`)}
        </p>
      )}
      {state.last_tested_at && (
        <p className="help-note">
          {t('integrations.lastTested')}: {new Date(state.last_tested_at).toLocaleString()}
        </p>
      )}
    </div>
  );
}
export function IntegrationsSettings() {
  const t = useTranslations(),
    api = useServices().integrations!;
  const { data, error, busy, refresh } = useAsyncData(() => api.status(), [api]);
  const [applying, setApplying] = useState(false),
    [actionError, setActionError] = useState('');
  return (
    <>
      <section className="settings-section">
        <h2>{t('integrations.title')}</h2>
        <div className="integrations-ledger">
          <p className="help-note">{t('integrations.description')}</p>
          {busy && <p role="status">{t('aiLoading')}</p>}
          {!!error && (
            <p role="alert">
              {t(error instanceof PortError ? error.userMessage : 'backendErrors.unknown')}
            </p>
          )}
          {data?.integrations.map((state) => (
            <IntegrationRow key={state.id} initial={state} refresh={refresh} />
          ))}
          <div className="integration-row">
            <h3>{t('integrations.workflows')}</h3>
            <ul>
              {data?.workflows.map((w) => (
                <li key={w.id}>
                  {w.name} · {t(w.active ? 'integrations.active' : 'integrations.inactive')}{' '}
                  <small>{w.version?.slice(0, 8)}</small>
                </li>
              ))}
            </ul>
            <Button
              disabled={applying}
              onClick={() => {
                setApplying(true);
                setActionError('');
                void api
                  .reapply()
                  .then(refresh)
                  .catch((e) =>
                    setActionError(
                      t(e instanceof PortError ? e.userMessage : 'backendErrors.unknown'),
                    ),
                  )
                  .finally(() => setApplying(false));
              }}
            >
              {t('integrations.reapply')}
            </Button>
            {applying && <p role="status">{t('integrations.step_sync')}</p>}
            {actionError && <p role="alert">{actionError}</p>}
          </div>
        </div>
      </section>
      <section className="settings-section" id="knowledge-base">
        <h2>{t('integrations.knowledge')}</h2>
        <div>
          {data?.knowledge.devOnly && <p className="help-note">{t('integrations.devSeed')}</p>}
          <p>{t('integrations.chunkCount', { count: data?.knowledge.count ?? 0 })}</p>
          <p className="help-note">
            {data?.knowledge.model ?? '—'} / {data?.knowledge.dimensions ?? 1536}
          </p>
          <ul>
            {Object.entries(data?.knowledge.datasets ?? {}).map(([name, count]) => (
              <li key={name}>
                {name}: {count}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
