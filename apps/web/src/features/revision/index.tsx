'use client';
import { useEffect, useState } from 'react';
import type { RevisionProposal } from '@naskah/contracts';
import type { Change } from 'diff';
import { useTranslations } from 'next-intl';
import { Button, Modal } from '@/shared/ui';
function Unchanged({ text }: { text: string }) {
  const t = useTranslations();
  const [expanded, setExpanded] = useState(false);
  const lines = text.split('\n');
  if (lines.length <= 12 || expanded) return <span>{text}</span>;
  return (
    <span>
      {lines.slice(0, 3).join('\n')}
      <button className="diff-collapse" onClick={() => setExpanded(true)}>
        {t('showUnchanged', { count: lines.length - 6 })}
      </button>
      {lines.slice(-3).join('\n')}
    </span>
  );
}
export function DiffViewer({
  proposal,
  onAccept,
  onReject,
  busy = false,
}: {
  proposal: RevisionProposal | undefined;
  onAccept: () => void;
  onReject: () => void;
  busy?: boolean;
}) {
  const t = useTranslations();
  const [changes, setChanges] = useState<Change[]>([]);
  const [unified, setUnified] = useState(false);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    if (proposal)
      void import('diff').then(({ diffWords }) =>
        setChanges(diffWords(proposal.before, proposal.after)),
      );
  }, [proposal]);
  return (
    <>
      <Modal
        wide
        open={!!proposal}
        onOpenChange={(open) => {
          if (!open) {
            if (proposal?.status === 'accepted') onReject();
            else setConfirm(true);
          }
        }}
        title={t('diffTitle')}
        description={t('diffDescription')}
        onEscape={onReject}
      >
        <div className="diff-tools">
          <span>
            {proposal?.sectionId} / {proposal?.instruction}
          </span>
          <Button variant="text" onClick={() => setUnified((v) => !v)}>
            {t(unified ? 'sideBySide' : 'unified')}
          </Button>
        </div>
        <div className={`diff-grid ${unified ? 'unified' : ''}`}>
          {!unified && (
            <div>
              <h3>{t('before')}</h3>
              <div className="diff-content">
                {changes
                  .filter((c) => !c.added)
                  .map((c, i) =>
                    c.removed ? <del key={i}>{c.value}</del> : <Unchanged key={i} text={c.value} />,
                  )}
              </div>
            </div>
          )}
          <div>
            <h3>{t('after')}</h3>
            <div className="diff-content">
              {changes
                .filter((c) => unified || !c.removed)
                .map((c, i) =>
                  c.added ? (
                    <mark key={i}>{c.value}</mark>
                  ) : c.removed ? (
                    <del key={i}>{c.value}</del>
                  ) : (
                    <Unchanged key={i} text={c.value} />
                  ),
                )}
            </div>
          </div>
        </div>
        <details className="diff-details">
          <summary>{t('refinedQuery')}</summary>
          <p>{proposal?.retrievalQuery}</p>
        </details>
        <div className="modal-actions">
          <Button onClick={onReject} disabled={busy}>
            {t('cancel')}
          </Button>
          {proposal?.status !== 'accepted' && (
            <Button variant="primary" onClick={onAccept} disabled={busy}>
              {t('apply')}
            </Button>
          )}
        </div>
      </Modal>
      <Modal
        open={confirm}
        onOpenChange={setConfirm}
        title={t('cancel')}
        description={t('diffDescription')}
      >
        <div className="modal-actions">
          <Button onClick={() => setConfirm(false)}>{t('back')}</Button>
          <Button
            variant="primary"
            onClick={() => {
              setConfirm(false);
              onReject();
            }}
          >
            {t('cancel')}
          </Button>
        </div>
      </Modal>
    </>
  );
}
