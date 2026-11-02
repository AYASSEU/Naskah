'use client';
import { useState, useEffect, useRef, Fragment } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Check,
  Lock,
  PanelLeft,
  PanelRight,
  FileCheck2,
  Pencil,
  MessageSquareText,
  Copy,
  History,
  Unlock,
  X,
} from 'lucide-react';
import type { Section, RevisionProposal, DocumentVersion } from '@naskah/contracts';
import type { GenerationHandle, GenerationEvent } from '@/services/ports';
import { PortError } from '@/services/ports';
import { useServices, useAsyncData, ErrorState, Loading, useToast } from '@/shared/lib/providers';
import { usePreferences } from '@/shared/lib/ui-store';
import { Button, Modal, Menu, Status } from '@/shared/ui';
import { Markdown } from '@/shared/ui/markdown';
import { ieeeTemplate } from '@/entities/template/ieee';
import { parseRequirements, duplicateIds } from '@/entities/requirement/parsing';
import { applyRevision } from '@/entities/revision/apply';
import { DiffViewer } from '@/features/revision';
const ManuscriptEditor = dynamic(() => import('./manuscript-editor'), {
  ssr: false,
  loading: () => <Loading />,
});
export function ManuscriptSection({ section: s }: { section: Section }) {
  const t = useTranslations();
  return s.requirements.length ? (
    <div className="manuscript-text">
      {s.markdown.indexOf('**REQ-') > 0 && (
        <Markdown
          text={s.markdown.slice(0, s.markdown.indexOf('**REQ-'))}
          rewrites={s.guardrail.rewrites}
        />
      )}{' '}
      {s.requirements.map((r) => (
        <div className="requirement-entry" key={r.id}>
          <span className="requirement-id">{r.id}</span>
          <h4>{r.title}</h4>
          <Markdown
            text={r.description.split('\n\nPrioritas:')[0] || r.description}
            rewrites={s.guardrail.rewrites}
          />
          <div className="requirement-details">
            {r.description.split('\n\n').find((p) => p.startsWith('Aktor:')) ||
              `${r.actor} / ${r.input} / ${r.output}`}
          </div>
          <div className="requirement-priority">
            {t('priority')}: {t(r.priority.toLowerCase())}
          </div>
        </div>
      ))}
    </div>
  ) : (
    <Markdown text={s.markdown} rewrites={s.guardrail.rewrites} />
  );
}
export function Workspace({ id }: { id: string }) {
  const t = useTranslations();
  const services = useServices();
  const toast = useToast();
  const router = useRouter();
  const paper = usePreferences((s) => s.paper);
  const { data, error, busy, refresh } = useAsyncData(
    async () => ({
      project: await services.projects.get(id),
      document: await services.documents.getDocument(id),
      versions: await services.documents.listVersions(id),
    }),
    [id],
  );
  const [selected, setSelected] = useState('1.1');
  const [panel, setPanel] = useState('summary');
  const [showContents, setShowContents] = useState(false);
  const [showInspector, setShowInspector] = useState(false);
  const [events, setEvents] = useState<GenerationEvent[]>([]);
  const handle = useRef<GenerationHandle | undefined>(undefined);
  const subscribed = useRef(false);
  const [elapsed, setElapsed] = useState(0);
  const [editing, setEditing] = useState<string>();
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [revisionTarget, setRevisionTarget] = useState<Section>();
  const [instruction, setInstruction] = useState('');
  const [pendingRevisions, setPendingRevisions] = useState<string[]>([]);
  const [proposals, setProposals] = useState<RevisionProposal[]>([]);
  const proposal = proposals[0];
  const enqueueProposal = (next: RevisionProposal) => setProposals((current) => [...current, next]);
  const dismissProposal = () => setProposals((current) => current.slice(1));
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [finalizeOpen, setFinalizeOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [errorDialog, setErrorDialog] = useState('');
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const section = query.get('section');
    const p = query.get('panel');
    if (section) {
      setSelected(section);
      setTimeout(
        () => document.getElementById(`section-${section}`)?.scrollIntoView({ block: 'start' }),
        500,
      );
    }
    if (p) {
      setPanel(p);
      setShowInspector(true);
    }
  }, []);
  useEffect(() => {
    if (data?.project.status !== 'generating' || subscribed.current) return;
    subscribed.current = true;
    const p = data.project;
    const current = services.generation.start({
      session_id: p.sessionId,
      project_title: p.title,
      domain: p.domain,
      raw_text: p.rawText,
    });
    handle.current = current;
    setEvents(current.getSnapshot());
    const unsubscribe = current.subscribe((event) => {
      setEvents((old) => [...old, event]);
      if (event.type === 'section_drafted' || event.type === 'completed' || event.type === 'failed')
        void refresh();
    });
    return () => {
      unsubscribe();
      subscribed.current = false;
    };
  }, [data?.project.status, id, services, refresh]);
  useEffect(() => {
    if (data?.project.status !== 'generating') return;
    const interval = setInterval(() => setElapsed((n) => n + 1), 1000);
    return () => clearInterval(interval);
  }, [data?.project.status]);
  const section =
    data?.document.sections.find((s) => s.id === selected) || data?.document.sections[0];
  const editSection = data?.document.sections.find((s) => s.id === editing);
  async function persistEdit() {
    if (!editSection || !dirty) return;
    setSaving(true);
    try {
      await services.documents.saveSection(id, {
        ...editSection,
        markdown: editValue,
        requirements: parseRequirements(editValue),
        status: 'edited',
        source: 'human',
        updatedAt: new Date().toISOString(),
      });
      setDirty(false);
      await refresh();
    } catch (e) {
      setErrorDialog(t(e instanceof PortError ? e.userMessage : 'storageError'));
    } finally {
      setSaving(false);
    }
  }
  useEffect(() => {
    if (!dirty || !editing) return;
    const timer = setTimeout(() => void persistEdit(), 800);
    return () => clearTimeout(timer);
  }, [editValue, editing, dirty]);
  function navigate(sectionId: string, p = panel) {
    setSelected(sectionId);
    setPanel(p);
    window.history.replaceState(
      null,
      '',
      `/workspace/${id}?section=${encodeURIComponent(sectionId)}&panel=${p}`,
    );
    document.getElementById(`section-${sectionId}`)?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'instant'
        : 'smooth',
      block: 'start',
    });
    setShowContents(false);
  }
  async function lock(s: Section) {
    try {
      await services.documents.saveSection(id, {
        ...s,
        status: s.status === 'locked' ? 'drafted' : 'locked',
      });
      await refresh();
    } catch (e) {
      setErrorDialog(t(e instanceof PortError ? e.userMessage : 'storageError'));
    }
  }
  async function rewrite(s: Section, rewriteId: string, revert: boolean) {
    const r = s.guardrail.rewrites.find((r) => r.id === rewriteId);
    if (!r || s.status === 'locked') return;
    try {
      await services.documents.saveSection(id, {
        ...s,
        markdown: revert ? s.markdown.replace(r.rewritten, r.original) : s.markdown,
        status: revert ? 'edited' : s.status,
        guardrail: {
          ...s.guardrail,
          rewrites: s.guardrail.rewrites.map((r) =>
            r.id === rewriteId ? { ...r, resolved: true } : r,
          ),
        },
      });
      await refresh();
    } catch (e) {
      setErrorDialog(t(e instanceof PortError ? e.userMessage : 'storageError'));
    }
  }
  async function requestRevision() {
    if (!revisionTarget || !data || pendingRevisions.includes(revisionTarget.id)) return;
    const target = revisionTarget;
    setActionError('');
    setPendingRevisions((old) => [...old, target.id]);
    try {
      const next = await services.revision.requestRevision({
        session_id: data.project.sessionId,
        target_section: `${target.id} ${target.title}`,
        current_section_text: target.markdown,
        user_instructions: instruction,
      });
      setRevisionTarget((current) => (current?.id === target.id ? undefined : current));
      enqueueProposal(next);
    } catch (e) {
      setActionError(t(e instanceof PortError ? e.userMessage : 'revisionError'));
    } finally {
      setPendingRevisions((old) => old.filter((id) => id !== target.id));
    }
  }
  async function apply() {
    if (!proposal) return;
    setActionBusy(true);
    try {
      const latest = await services.documents.getDocument(id);
      await services.documents.saveSections(
        id,
        applyRevision(latest.sections, proposal),
        t('applied'),
      );
      dismissProposal();
      toast(t('applied'));
      await refresh();
    } catch (e) {
      setErrorDialog(e instanceof Error ? e.message : t('storageError'));
    } finally {
      setActionBusy(false);
    }
  }
  async function finalize() {
    if (!data) return;
    setActionBusy(true);
    try {
      await services.documents.saveSections(
        id,
        data.document.sections.map((s) => ({ ...s, status: 'locked' })),
        t('finalize'),
      );
      await services.projects.update(id, { status: 'finalized', version: '1.0' });
      router.push(`/export/${id}`);
    } catch (e) {
      setErrorDialog(t(e instanceof PortError ? e.userMessage : 'storageError'));
    } finally {
      setActionBusy(false);
    }
  }
  async function resume() {
    if (!data) return;
    services.simulation.failure = 'none';
    setEvents([]);
    setElapsed(0);
    await services.projects.update(id, { status: 'generating' });
    await refresh();
  }
  async function restore(version: DocumentVersion) {
    try {
      await services.documents.restoreVersion(id, version.id);
      await refresh();
      toast(t('saved'));
    } catch (e) {
      setErrorDialog(t(e instanceof PortError ? e.userMessage : 'storageError'));
    }
  }
  if (error) return <ErrorState error={error} retry={refresh} />;
  if (busy || !data || !section) return <Loading />;
  const p = data.project;
  const d = data.document;
  const generating = p.status === 'generating';
  const totalRewrites = d.sections.reduce((n, s) => n + s.guardrail.rewrites.length, 0);
  const unresolved = d.sections.reduce(
    (n, s) => n + s.guardrail.rewrites.filter((r) => !r.resolved).length,
    0,
  );
  const pending = d.sections.filter((s) => s.status === 'pending').length;
  const duplicateRequirements = duplicateIds(
    d.sections
      .filter((s) => s.requirements.length)
      .map((s) => s.markdown)
      .join('\n'),
  );
  const latestStage = [...events].reverse().find((e) => e.type === 'stage');
  const stageIndex =
    latestStage?.type === 'stage'
      ? ['retrieving_context', 'drafting', 'guardrail', 'assembling', 'ready'].indexOf(
          latestStage.stage,
        )
      : 0;
  return (
    <main>
      <div className="workspace-toolbar">
        <div>
          <h1>{p.title}</h1>
          <div className="document-meta">
            <span>v{p.version}</span>
            <Status status={p.status} />
          </div>
        </div>
        <div className="workspace-toolbar-actions">
          <span>{t(saving || dirty ? 'saving' : 'saved')}</span>
          <div className="mobile-tools">
            <button
              className="icon-button mobile-contents-button"
              aria-label={t('contents')}
              onClick={() => setShowContents((v) => !v)}
            >
              <PanelLeft />
            </button>
            <button
              className="icon-button"
              aria-label={t('inspector')}
              onClick={() => setShowInspector((v) => !v)}
            >
              <PanelRight />
            </button>
          </div>
          {p.status === 'finalized' ? (
            <Link className="button primary" href={`/export/${id}`}>
              <FileCheck2 />
              {t('downloadDocx')}
            </Link>
          ) : (
            <Button
              variant="primary"
              onClick={() => {
                setFinalizeOpen(true);
                setConfirmed(false);
              }}
              disabled={generating || pending > 0 || !!editing || pendingRevisions.length > 0}
            >
              <FileCheck2 />
              {t('finalize')}
            </Button>
          )}
        </div>
      </div>
      <div className="workspace">
        <aside className={`contents-rail ${!showContents ? 'collapsed' : ''}`}>
          <h2>{t('contents')}</h2>
          {ieeeTemplate.chapters.map((c) => (
            <div key={c.number}>
              <div className="chapter-link">
                <span>{c.number}</span>
                {c.title}
              </div>
              {c.subsections.map((sub) => {
                const s = d.sections.find((s) => s.id === sub.number);
                return (
                  <button
                    key={sub.number}
                    className={`contents-link ${selected === sub.number ? 'active' : ''}`}
                    onClick={() => navigate(sub.number)}
                    style={{ width: '100%', textAlign: 'left', background: undefined }}
                  >
                    <span>{sub.number}</span>
                    {sub.title.split(' (')[0]}
                    {s?.status === 'locked' ? <Lock /> : s?.status !== 'pending' ? <Check /> : null}
                  </button>
                );
              })}
            </div>
          ))}
          <div className="contents-footer">
            {t('standard')}
            <br />
            {d.sections.reduce((n, s) => n + s.requirements.length, 0)} {t('requirements')}
            <br />
            <br />
            {t('simulation')}
          </div>
        </aside>
        <div className="manuscript-region">
          {generating || p.status === 'failed' || p.status === 'draft_input' ? (
            <section className="progress-ledger" aria-live="polite">
              <h2>{t('generationTitle')}</h2>
              {['stage1', 'stage2', 'stage3', 'stage4'].map((name, i) => (
                <div
                  className={`stage ${stageIndex > i ? 'done' : stageIndex === i ? 'active' : ''}`}
                  key={name}
                >
                  <span>{stageIndex > i ? <Check /> : null}</span>
                  {t(name)}
                  {i === 1 && (
                    <span className="mono" style={{ marginLeft: 'auto', width: 'auto', border: 0 }}>
                      {
                        ['1', '2', '3', '4'].filter((n) =>
                          d.sections
                            .filter((s) => s.number.startsWith(n + '.'))
                            .every((s) => s.status !== 'pending'),
                        ).length
                      }
                      /4
                    </span>
                  )}
                </div>
              ))}
              {p.status === 'failed' && <p className="inline-error">{t('generationError')}</p>}
              <footer>
                <span className="tabular">
                  {elapsed} s / {d.sections.filter((s) => s.status !== 'pending').length}{' '}
                  {t('sections')}
                </span>
                {generating ? (
                  <Button onClick={() => handle.current?.cancel()}>{t('cancel')}</Button>
                ) : (
                  <Button variant="primary" onClick={() => void resume()}>
                    {t('resume')}
                  </Button>
                )}
              </footer>
            </section>
          ) : (
            <div className="generation-summary">
              <Check />
              <span>
                {t('generatedSummary', { seconds: d.metadata.generationSeconds.toFixed(1) })}
              </span>
              <span>{t('referenceCount', { count: d.chunks.length })}</span>
              <span>{t('rewriteCount', { count: totalRewrites })}</span>
            </div>
          )}
          <article className={`manuscript ${paper ? 'paper-sheet' : ''}`}>
            <header className="manuscript-title">
              <p>Software Requirements Specification</p>
              <h2>{p.title}</h2>
              <div>
                <span>{t('standard')}</span>
                <span>{p.domain}</span>
                <span>v{p.version}</span>
              </div>
            </header>
            {ieeeTemplate.chapters.map((c) => (
              <Fragment key={c.number}>
                <div className="chapter-heading">
                  <span>{c.number}</span>
                  <h2>{c.title}</h2>
                </div>
                {d.sections
                  .filter((s) => s.number.startsWith(c.number + '.'))
                  .map((s) => (
                    <section
                      id={`section-${s.id}`}
                      className={`document-section ${selected === s.id ? 'selected' : ''}`}
                      key={s.id}
                      onClick={() => {
                        if (selected !== s.id) setSelected(s.id);
                      }}
                    >
                      <div className="section-heading">
                        <div>
                          <span className="section-number">{s.number}</span>
                          <h3>{s.title}</h3>
                        </div>
                        <div className="section-actions">
                          {s.status === 'locked' ? (
                            <span className="status">
                              <Lock />
                              {t('locked')}
                            </span>
                          ) : (
                            s.status !== 'pending' && (
                              <>
                                <Button
                                  variant="text"
                                  disabled={!!editing && editing !== s.id}
                                  onClick={() => {
                                    setEditing(s.id);
                                    setEditValue(s.markdown);
                                    setDirty(false);
                                    setSelected(s.id);
                                  }}
                                >
                                  <Pencil />
                                  {t('edit')}
                                </Button>
                                <Button
                                  variant="text"
                                  disabled={!!editing || pendingRevisions.includes(s.id)}
                                  onClick={() => {
                                    setRevisionTarget(s);
                                    setInstruction('');
                                    setActionError('');
                                    setSelected(s.id);
                                  }}
                                >
                                  <MessageSquareText />
                                  {t('aiRevision')}
                                </Button>
                              </>
                            )
                          )}
                          {s.status !== 'pending' && (
                            <Menu
                              label={`${t('menu')} ${s.number}`}
                              items={[
                                {
                                  label: t(s.status === 'locked' ? 'unlock' : 'lock'),
                                  icon: s.status === 'locked' ? <Unlock /> : <Lock />,
                                  action: () => void lock(s),
                                },
                                {
                                  label: t('copy'),
                                  icon: <Copy />,
                                  action: () => {
                                    void navigator.clipboard.writeText(s.markdown);
                                    toast(t('copySuccess'));
                                  },
                                },
                                {
                                  label: t('history'),
                                  icon: <History />,
                                  action: () => {
                                    setSelected(s.id);
                                    setPanel('history');
                                    setShowInspector(true);
                                  },
                                },
                              ]}
                            />
                          )}
                        </div>
                      </div>
                      {s.status === 'pending' ? (
                        <div className="section-skeleton">
                          <div className="skeleton-line" />
                          <div className="skeleton-line" />
                          <div className="skeleton-line short" />
                        </div>
                      ) : editing === s.id ? (
                        <ManuscriptEditor
                          usedMarkdown={d.sections
                            .filter((other) => other.id !== s.id)
                            .map((other) => other.markdown)
                            .join('\n')}
                          value={editValue}
                          onChange={(value) => {
                            setEditValue(value);
                            setDirty(true);
                          }}
                          saving={saving || dirty}
                          finish={() => {
                            void persistEdit().then(() => setEditing(undefined));
                          }}
                        />
                      ) : (
                        <>
                          <ManuscriptSection section={s} />
                          <div className="quality-strip">
                            {s.guardrail.dimensions.map((dim) => (
                              <span key={dim.name}>
                                <Check />
                                {t(dim.name)}
                              </span>
                            ))}
                          </div>
                        </>
                      )}
                    </section>
                  ))}
              </Fragment>
            ))}
          </article>
        </div>
        <aside className={`inspector ${!showInspector ? 'collapsed' : ''}`}>
          <div className="inspector-heading">
            <span>{t('inspector')}</span>
            <span className="mono">{section.number}</span>
            <button
              className="icon-button mobile-tools"
              aria-label={t('close')}
              onClick={() => setShowInspector(false)}
            >
              <X />
            </button>
          </div>
          <div className="inspector-tabs">
            {['summary', 'guardrail', 'referenceContext', 'history'].map((tab) => (
              <button
                key={tab}
                className={panel === tab ? 'active' : ''}
                onClick={() => {
                  setPanel(tab);
                  window.history.replaceState(
                    null,
                    '',
                    `/workspace/${id}?section=${selected}&panel=${tab}`,
                  );
                }}
              >
                {t(tab === 'referenceContext' ? 'source' : tab)}
              </button>
            ))}
          </div>
          <div className="inspector-body">
            <div className="inspector-section-id">
              {section.number} / {section.title}
            </div>
            {panel === 'summary' ? (
              <>
                <h3>{t('summary')}</h3>
                <dl className="inspector-dl">
                  <div>
                    <dt>{t('sectionStatus')}</dt>
                    <dd>
                      <Status status={section.status} />
                    </dd>
                  </div>
                  <div>
                    <dt>{t('source')}</dt>
                    <dd>{t(section.source === 'human' ? 'humanSource' : 'aiSource')}</dd>
                  </div>
                  <div>
                    <dt>{t('words')}</dt>
                    <dd>{section.markdown.split(/\s+/).filter(Boolean).length}</dd>
                  </div>
                  <div>
                    <dt>{t('requirements')}</dt>
                    <dd>{section.requirements.length}</dd>
                  </div>
                </dl>
                <div className="rule" />
                <h3>{t('qualityTitle')}</h3>
                <p>{t('qualityDescription')}</p>
                {section.guardrail.dimensions.map((dim) => (
                  <div className="quality-verdict" key={dim.name}>
                    <Check />
                    <div>
                      <strong>{t(dim.name)}</strong>
                      <p>{dim.reason}</p>
                    </div>
                  </div>
                ))}
                <div className="rule" />
                <Button variant="text" onClick={() => setPanel('guardrail')}>
                  {t('rewrites')} ({section.guardrail.rewrites.length})
                </Button>
              </>
            ) : panel === 'guardrail' ? (
              <>
                <h3>{t('rewrites')}</h3>
                {section.guardrail.rewrites.length === 0 && <p>{t('noRewrites')}</p>}
                {section.guardrail.rewrites.map((r) => (
                  <div className="rewrite-item" key={r.id}>
                    <label>{t('before')}</label>
                    <p>
                      <del>{r.original}</del>
                    </p>
                    <label>{t('after')}</label>
                    <p>
                      <mark>{r.rewritten}</mark>
                    </p>
                    <label>{t('reason')}</label>
                    <p>{r.reason}</p>
                    {r.resolved ? (
                      <Status status="locked" />
                    ) : (
                      <div className="rewrite-actions">
                        <Button
                          variant="text"
                          disabled={section.status === 'locked'}
                          onClick={() => void rewrite(section, r.id, false)}
                        >
                          {t('acceptRewrite')}
                        </Button>
                        <Button
                          variant="text"
                          disabled={section.status === 'locked'}
                          onClick={() => void rewrite(section, r.id, true)}
                        >
                          {t('revertRewrite')}
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </>
            ) : panel === 'referenceContext' ? (
              <>
                <h3>{t('referenceContext')}</h3>
                <p>{t('retrievalNote')}</p>
                {d.chunks.map((chunk) => (
                  <div className="reference-chunk" key={chunk.id}>
                    <header>
                      <span className="dataset">{chunk.dataset}</span>
                      <span className="tabular">{(chunk.similarity * 100).toFixed(2)}%</span>
                    </header>
                    <p>{chunk.excerpt}</p>
                  </div>
                ))}
              </>
            ) : (
              <>
                <h3>{t('history')}</h3>
                {data.versions.length === 0 && <p>{t('noHistory')}</p>}
                {data.versions.map((v) => (
                  <div key={v.id} className="version-row">
                    <strong>{v.label}</strong>
                    <p>{new Date(v.createdAt).toLocaleString()}</p>
                    <Button
                      variant="text"
                      disabled={p.status === 'finalized'}
                      onClick={() => void restore(v)}
                    >
                      {t('restore')}
                    </Button>
                    <Button
                      variant="text"
                      onClick={() => {
                        const before = v.sections.find((s) => s.id === selected)?.markdown || '';
                        enqueueProposal({
                          id: crypto.randomUUID(),
                          sectionId: selected,
                          instruction: v.label,
                          before,
                          after: section.markdown,
                          retrievalQuery: 'Version comparison',
                          status: 'accepted',
                        });
                      }}
                    >
                      {t('compare')}
                    </Button>
                  </div>
                ))}
              </>
            )}
          </div>
        </aside>
      </div>
      <Modal
        open={!!revisionTarget}
        onOpenChange={(open) => {
          if (!open) setRevisionTarget(undefined);
        }}
        title={t('aiRevision')}
        description={t('revisionDescription')}
      >
        <div className="revision-target">
          {revisionTarget?.number} {revisionTarget?.title}
        </div>
        <div className="revision-examples">
          {['example1', 'example2', 'example3'].map((key) => (
            <button key={key} onClick={() => setInstruction(t(key))}>
              {t(key)}
            </button>
          ))}
        </div>
        <label className="field">
          <span>{t('instruction')}</span>
          <textarea
            rows={5}
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder={t('instructionPlaceholder')}
            disabled={!!revisionTarget && pendingRevisions.includes(revisionTarget.id)}
          />
          <small>
            {instruction.length} {t('characters')}
          </small>
        </label>
        {actionError && (
          <p role="alert" className="inline-error">
            {actionError}
          </p>
        )}
        {revisionTarget && pendingRevisions.includes(revisionTarget.id) && (
          <p className="help-note" aria-live="polite">
            {t('revisionStage')}
          </p>
        )}
        <div className="modal-actions">
          <Button onClick={() => setRevisionTarget(undefined)}>{t('cancel')}</Button>
          <Button
            variant="primary"
            disabled={
              !instruction.trim() ||
              (!!revisionTarget && pendingRevisions.includes(revisionTarget.id))
            }
            onClick={() => void requestRevision()}
          >
            {t('sendRevision')}
          </Button>
        </div>
      </Modal>
      <DiffViewer
        proposal={proposal}
        onAccept={() => void apply()}
        onReject={dismissProposal}
        busy={actionBusy}
      />
      <Modal
        open={finalizeOpen}
        onOpenChange={setFinalizeOpen}
        title={t('finalizeTitle')}
        description={t('finalizeDescription')}
      >
        <p className="help-note">
          {unresolved} {t('unresolved')}
          <br />
          {pending} {t('pendingSections')}
        </p>
        {duplicateRequirements.length > 0 && (
          <p className="inline-error">
            {t('duplicateWarning')}: {duplicateRequirements.join(', ')}
          </p>
        )}
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          {t('finalizeConfirm')}
        </label>
        <div className="modal-actions">
          <Button onClick={() => setFinalizeOpen(false)}>{t('cancel')}</Button>
          <Button
            variant="primary"
            disabled={!confirmed || actionBusy || pending > 0 || duplicateRequirements.length > 0}
            onClick={() => void finalize()}
          >
            {t('finalizeAction')}
          </Button>
        </div>
      </Modal>
      <Modal open={!!errorDialog} onOpenChange={() => setErrorDialog('')} title={t('errorTitle')}>
        <p className="inline-error">{errorDialog}</p>
      </Modal>
    </main>
  );
}
