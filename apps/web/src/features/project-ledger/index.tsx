'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import {
  Plus,
  Search,
  FileText,
  ArrowUpRight,
  ArrowDown,
  Check,
  BookOpen,
  LayoutList,
  Copy,
  Trash2,
  Pencil,
  SlidersHorizontal,
  Clock3,
} from 'lucide-react';
import type { Project } from '@naskah/contracts';
import { useServices, useAsyncData, ErrorState, Loading, useToast } from '@/shared/lib/providers';
import { Button, Status, Segments, Menu, Modal, Select } from '@/shared/ui';
export function ProjectLedger() {
  const t = useTranslations();
  const locale = useLocale();
  const services = useServices();
  const router = useRouter();
  const toast = useToast();
  const { data, error, busy, refresh } = useAsyncData(async () => {
    const projects = await services.projects.list();
    return Promise.all(
      projects.map(async (p) => ({
        project: p,
        document: await services.documents.getDocument(p.id),
      })),
    );
  }, []);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [dialog, setDialog] = useState<{ type: 'rename' | 'delete'; project: Project }>();
  const [value, setValue] = useState('');
  const [actionError, setActionError] = useState<unknown>();
  const [saving, setSaving] = useState(false);
  const list = data || [];
  const pinned = list.find((item) => item.project.status === 'in_review');
  const filtered = list.filter(
    ({ project: p }) =>
      p.title.toLowerCase().includes(query.toLowerCase()) &&
      (filter === 'all' || p.status === filter),
  );
  const progress = (id: string) =>
    ['1', '2', '3', '4'].map((n) => {
      const sections =
        list
          .find((item) => item.project.id === id)
          ?.document.sections.filter((s) => s.number.startsWith(n + '.')) || [];
      return sections.every((s) => s.status === 'locked')
        ? 'complete'
        : sections.every((s) => s.status !== 'pending')
          ? 'drafted'
          : 'pending';
    });
  async function duplicate(p: Project) {
    try {
      const copy = await services.projects.create({
        title: `${p.title} (${locale === 'id' ? 'salinan' : 'copy'})`,
        domain: p.domain,
        version: '0.1',
        status: 'draft_input',
        rawText: p.rawText,
      });
      router.push(`/workspace/${copy.id}`);
    } catch (e) {
      setActionError(e);
    }
  }
  async function submit() {
    if (!dialog) return;
    setSaving(true);
    try {
      if (dialog.type === 'delete') await services.projects.delete(dialog.project.id);
      else await services.projects.update(dialog.project.id, { title: value.trim() });
      setDialog(undefined);
      toast(t(dialog.type === 'delete' ? 'delete' : 'saved'));
      await refresh();
    } catch (e) {
      setActionError(e);
    } finally {
      setSaving(false);
    }
  }
  if (error) return <ErrorState error={error} retry={refresh} />;
  return (
    <main className="ledger page">
      <div className="page-heading">
        <div>
          <h1>{t('yourDocuments')}</h1>
          <p>{t('ledgerDescription')}</p>
        </div>
        <Link className="button primary" href="/new-project">
          <Plus />
          {t('newProject')}
        </Link>
      </div>
      {busy ? (
        <Loading />
      ) : list.length === 0 ? (
        <div className="empty-state">
          <div className="empty-drafting-mark">
            <FileText />
          </div>
          <h2>{t('empty')}</h2>
          <p>{t('emptyDescription')}</p>
          <Link href="/new-project" className="button primary">
            {t('startEmpty')}
          </Link>
          <Button
            variant="text"
            onClick={async () => {
              await services.loadExamples();
              await refresh();
            }}
          >
            {t('loadExamples')}
          </Button>
        </div>
      ) : (
        <>
          <div className="ledger-summary">
            <span>{t('documentCount', { count: list.length })}</span>
            <span className="summary-divider" />
            <span>
              <span className="small-square review" />
              {t('reviewCount', {
                count: list.filter((x) => x.project.status === 'in_review').length,
              })}
            </span>
            <span>
              <Check />
              {t('completeCount', {
                count: list.filter((x) => x.project.status === 'finalized').length,
              })}
            </span>
          </div>
          {pinned && (
            <section className="continue-panel">
              <div className="document-preview" aria-hidden="true">
                <div className="mini-paper">
                  <div className="mini-paper-top">
                    Software Requirements
                    <br />
                    Specification
                  </div>
                  <span className="mini-rule" />
                  <h3>{pinned.project.title}</h3>
                  <p>1. Introduction</p>
                  <i />
                  <i />
                  <i className="short" />
                  <p>2. Overall Description</p>
                  <i />
                  <i className="highlight" />
                  <i />
                  <div className="mini-bottom">
                    IEEE 830-1998 <span>01</span>
                  </div>
                </div>
                <span className="preview-label">
                  <FileText /> SRS
                </span>
              </div>
              <div className="continue-main">
                <span className="quiet-label">
                  <Clock3 />
                  {t('continueLabel')}
                </span>
                <h2>{pinned.project.title}</h2>
                <div className="continue-meta">
                  <span>{pinned.project.domain}</span>
                  <span>v{pinned.project.version}</span>
                  <Status status={pinned.project.status} />
                </div>
                <div className="continue-progress">
                  <Segments values={progress(pinned.project.id)} />
                  <span>4 / 4 {t('chapter').toLowerCase()}</span>
                </div>
                <Link
                  className="text-link continue-link"
                  href={`/workspace/${pinned.project.id}?section=3.2`}
                >
                  <BookOpen />
                  {t('continue')}
                  <ArrowUpRight />
                </Link>
              </div>
              <div className="continue-note">
                <span className="page-corner">3.2</span>
                <p>{t('reviewChapter')}</p>
                <span>
                  {pinned.document.sections.reduce((sum, s) => sum + s.requirements.length, 0)}{' '}
                  {t('requirements')}
                </span>
                <div className="margin-note">
                  <span />
                  {t('reviewHint')}
                </div>
              </div>
            </section>
          )}
          <section className="ledger-table-section">
            <div className="table-tools">
              <div className="table-title">
                <LayoutList />
                <h2>{t('allDocuments')}</h2>
                <span>{list.length}</span>
              </div>
              <div className="table-filters">
                <label className="search-field">
                  <Search />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t('search')}
                    aria-label={t('search')}
                  />
                  <kbd>/</kbd>
                </label>
                <Select
                  label={t('status')}
                  value={filter}
                  onChange={setFilter}
                  options={['all', 'in_review', 'finalized', 'failed', 'draft_input'].map((v) => ({
                    value: v,
                    label: t(v),
                  }))}
                />
                <SlidersHorizontal className="filter-icon" />
              </div>
            </div>
            <div className="table-scroll">
              <table className="project-table">
                <thead>
                  <tr>
                    <th>
                      {t('title')}
                      <ArrowDown />
                    </th>
                    <th>{t('domain')}</th>
                    <th>{t('progress')}</th>
                    <th>{t('status')}</th>
                    <th>{t('updated')}</th>
                    <th>
                      <span className="sr-only">{t('menu')}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(({ project: p, document: d }) => (
                    <tr key={p.id}>
                      <td>
                        <Link href={`/workspace/${p.id}`} className="project-title-cell">
                          <span className="file-mark">
                            <FileText />
                          </span>
                          <span>
                            <strong>{p.title}</strong>
                            <small>
                              v{p.version}
                              <span className="meta-slash">/</span>
                              {d.sections.reduce((sum, s) => sum + s.requirements.length, 0)}{' '}
                              {t('requirements')}
                            </small>
                          </span>
                        </Link>
                      </td>
                      <td>
                        <span className="domain-label">{p.domain}</span>
                      </td>
                      <td>
                        <div className="table-progress">
                          <Segments values={progress(p.id)} />
                          <span>{progress(p.id).filter((s) => s !== 'pending').length}/4</span>
                        </div>
                      </td>
                      <td>
                        <Status status={p.status} />
                      </td>
                      <td className="date-cell">
                        {new Intl.DateTimeFormat(locale === 'id' ? 'id-ID' : 'en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          timeZone: 'Asia/Jakarta',
                        }).format(new Date(p.updatedAt))}
                      </td>
                      <td>
                        <Menu
                          label={`${t('menu')}: ${p.title}`}
                          items={[
                            {
                              label: t('open'),
                              icon: <BookOpen />,
                              action: () => router.push(`/workspace/${p.id}`),
                            },
                            {
                              label: t('duplicate'),
                              icon: <Copy />,
                              action: () => void duplicate(p),
                            },
                            {
                              label: t('rename'),
                              icon: <Pencil />,
                              action: () => {
                                setDialog({ type: 'rename', project: p });
                                setValue(p.title);
                              },
                            },
                            {
                              label: t('delete'),
                              icon: <Trash2 />,
                              danger: true,
                              action: () => {
                                setDialog({ type: 'delete', project: p });
                                setValue('');
                              },
                            },
                          ]}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && <p className="no-results">{t('noResults')}</p>}
            </div>
            <div className="table-bottom">
              <span>{t('documentCount', { count: filtered.length })}</span>
            </div>
          </section>
          <div className="ledger-bottom-note">
            <span className="standard-mark">
              <span>830</span> IEEE
            </span>
            <p>{t('aboutStandard')}</p>
            <Link href="/evaluation">
              {t('evaluation')}
              <ArrowUpRight />
            </Link>
          </div>
        </>
      )}
      <Modal
        open={!!dialog}
        onOpenChange={(open) => {
          if (!open) setDialog(undefined);
        }}
        title={t(dialog?.type === 'delete' ? 'delete' : 'renameTitle')}
        description={dialog?.type === 'delete' ? t('deleteWarning') : undefined}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <p className="dialog-project-name">{dialog?.project.title}</p>
          <label className="field">
            <span>{t('title')}</span>
            <input autoFocus value={value} onChange={(e) => setValue(e.target.value)} required />
          </label>
          <div className="modal-actions">
            <Button onClick={() => setDialog(undefined)}>{t('cancel')}</Button>
            <Button
              type="submit"
              variant="primary"
              disabled={
                saving ||
                !value.trim() ||
                (dialog?.type === 'delete' && value !== dialog.project.title)
              }
            >
              {t(dialog?.type === 'delete' ? 'delete' : 'save')}
            </Button>
          </div>
        </form>
      </Modal>
      {!!actionError && (
        <Modal open onOpenChange={() => setActionError(undefined)} title={t('errorTitle')}>
          <ErrorState error={actionError} />
        </Modal>
      )}
    </main>
  );
}
