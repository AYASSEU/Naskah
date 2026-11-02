'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useServices, useToast } from '@/shared/lib/providers';
import { appEvents } from '@/shared/lib/events';
import { flags } from '@/shared/config/flags';
import type { SimulationConfig } from '@/services/ports';
import { Modal, Select, Button } from '@/shared/ui';
export function Devtools() {
  const t = useTranslations();
  const services = useServices();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [speed, setSpeed] = useState(services.simulation.speed);
  const [failure, setFailure] = useState(services.simulation.failure);
  const [confirmClear, setConfirmClear] = useState(false);
  useEffect(() => {
    if (!flags.devtools) return;
    const keyboard = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', keyboard);
    const off = appEvents.on('devtools', () => setOpen(true));
    return () => {
      window.removeEventListener('keydown', keyboard);
      off();
    };
  }, []);
  if (!flags.devtools) return null;
  return (
    <>
      <Modal open={open} onOpenChange={setOpen} title={t('developer')}>
        <div className="setting-row">
          <label>{t('speed')}</label>
          <Select
            label={t('speed')}
            value={speed}
            onChange={(v) => {
              setSpeed(v as SimulationConfig['speed']);
              services.simulation.speed = v as SimulationConfig['speed'];
            }}
            options={['instant', 'normal', 'slow'].map((v) => ({ value: v, label: t(v) }))}
          />
        </div>
        <div className="setting-row">
          <label>{t('failure')}</label>
          <Select
            label={t('failure')}
            value={failure}
            onChange={(v) => {
              setFailure(v as SimulationConfig['failure']);
              services.simulation.failure = v as SimulationConfig['failure'];
            }}
            options={['none', 'retrieval', 'chapter3', 'guardrail', 'revision'].map((v) => ({
              value: v,
              label: t(v),
            }))}
          />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Button
            onClick={() =>
              void services.loadExamples().then(() => {
                toast(t('saved'));
                window.location.reload();
              })
            }
          >
            {t('loadExamples')}
          </Button>
          <Button className="danger" onClick={() => setConfirmClear(true)}>
            {t('reset')}
          </Button>
        </div>
        <div className="rule" />
        <h3>{t('lastCalls')}</h3>
        <div className="call-log">
          {services.calls.map((call, i) => (
            <p key={i}>
              {call.at.slice(11, 19)} {call.method}
            </p>
          ))}
        </div>
      </Modal>
      <Modal
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title={t('resetTitle')}
        description={t('resetDescription')}
      >
        <div className="modal-actions">
          <Button onClick={() => setConfirmClear(false)}>{t('cancel')}</Button>
          <Button
            variant="primary"
            onClick={() => void services.reset().then(() => window.location.reload())}
          >
            {t('reset')}
          </Button>
        </div>
      </Modal>
    </>
  );
}
