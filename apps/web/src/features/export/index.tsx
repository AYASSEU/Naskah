'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Download, FileText, Printer, Check, BookOpen } from 'lucide-react';
import { useServices, useAsyncData, ErrorState, Loading } from '@/shared/lib/providers';
import { usePreferences } from '@/shared/lib/ui-store';
import { Button } from '@/shared/ui';
import { PortError } from '@/services/ports';
import { ieeeTemplate } from '@/entities/template/ieee';
import { Markdown } from '@/shared/ui/markdown';
export function ExportDocument({ id }: { id: string }) {
  const t = useTranslations();
  const services = useServices();
  const research = usePreferences((s) => s.research);
  const { data, error, busy, refresh } = useAsyncData(
    async () => ({
      project: await services.projects.get(id),
      document: await services.documents.getDocument(id),
    }),
    [id],
  );
  const [state, setState] = useState<Record<string, 'idle' | 'compiling' | 'ready' | 'failed'>>({
    docx: 'idle',
    pdf: 'idle',
  });
  const [artifact, setArtifact] = useState('');
  const [downloaded, setDownloaded] = useState(false);
  const [compileError, setCompileError] = useState('');
  async function download(format: 'docx' | 'pdf') {
    setState((s) => ({ ...s, [format]: 'compiling' }));
    setCompileError('');
    try {
      const result = await services.compiler.compile(id, format);
      if (format === 'pdf') {
        window.open(result.url, '_blank', 'noopener,noreferrer');
      } else {
        const a = document.createElement('a');
        a.href = result.url;
        a.download = result.filename;
        a.click();
        setArtifact(`${result.filename} / ${(result.size / 1024).toFixed(1)} KB`);
        setTimeout(() => URL.revokeObjectURL(result.url), 60000);
      }
      setState((s) => ({ ...s, [format]: 'ready' }));
      setDownloaded(true);
    } catch (e) {
      setState((s) => ({ ...s, [format]: 'failed' }));
      setCompileError(t(e instanceof PortError ? e.userMessage : 'storageError'));
    }
  }
  if (error) return <ErrorState error={error} retry={refresh} />;
  if (busy || !data) return <Loading />;
  const { project: p, document: d } = data;
  const requirements = d.sections.flatMap((s) => s.requirements);
  const completeness = (d.sections.filter((s) => s.markdown).length / d.sections.length) * 100;
  return (
    <main className="page">
      <Link href={`/workspace/${id}`} className="back-link">
        <ArrowLeft />
        {t('backWorkspace')}
      </Link>
      <div className="page-heading">
        <div>
          <h1>{t('exportTitle')}</h1>
          <p>{t('exportDescription')}</p>
        </div>
      </div>
      <div className="export-layout">
        <div>
          <div className="export-preview">
            <div className="export-paper">
              <span className="paper-standard">IEEE 830-1998</span>
              <h2>
                Software Requirements
                <br />
                Specification
              </h2>
              <div className="paper-rule" />
              <h3>{p.title}</h3>
              <p style={{ marginTop: 22 }}>
                {t('version')} {p.version}
                <br />
                {p.domain}
              </p>
              <div className="paper-footer">
                <span>{t('standard')}</span>
                <span>1</span>
              </div>
            </div>
          </div>
          <Link className="text-link" style={{ marginTop: 18 }} href={`/workspace/${id}`}>
            <BookOpen />
            {t('readDocument')}
          </Link>
        </div>
        <aside className="export-summary">
          <h2>{t('documentSummary')}</h2>
          <div className="summary-rows">
            <div>
              <span>{t('requirements')}</span>
              <span>{requirements.length}</span>
            </div>
            {['High', 'Medium', 'Low'].map((priority) => (
              <div key={priority}>
                <span>
                  {t('priority')} {t(priority.toLowerCase()).toLowerCase()}
                </span>
                <span>{requirements.filter((r) => r.priority === priority).length}</span>
              </div>
            ))}
            <div>
              <span>{t('structureComplete')}</span>
              <span>
                <Check
                  style={{
                    width: 12,
                    height: 12,
                    color: 'var(--positive)',
                    display: 'inline',
                    marginRight: 5,
                  }}
                />
                {completeness.toFixed(0)}%
              </span>
            </div>
            <div>
              <span>{t('rewrites')}</span>
              <span>{d.sections.reduce((n, s) => n + s.guardrail.rewrites.length, 0)}</span>
            </div>
            <div>
              <span>{t('generationTime')}</span>
              <span>{d.metadata.generationSeconds.toFixed(1)} s</span>
            </div>
          </div>
          <div className="export-actions">
            <Button
              variant="primary"
              disabled={state.docx === 'compiling' || p.status !== 'finalized'}
              onClick={() => void download('docx')}
            >
              <Download />
              {t(state.docx === 'compiling' ? 'compiling' : 'downloadDocx')}
            </Button>
            <Button
              disabled={state.pdf === 'compiling' || p.status !== 'finalized'}
              onClick={() => void download('pdf')}
            >
              <Printer />
              {t('downloadPdf')}
            </Button>
          </div>
          {p.status !== 'finalized' && (
            <Link className="text-link" href={`/workspace/${id}`}>
              {t('finalize')}
            </Link>
          )}
          {artifact && <p className="help-note mono">{artifact}</p>}
          {compileError && <p className="inline-error">{compileError}</p>}
          <p className="help-note">{t('exportNote')}</p>
          <div className="rule" />
          <p className="help-note">{t('pdfNote')}</p>
          {research && downloaded && (
            <div className="research-prompt">
              <p>{t('researchInvite')}</p>
              <Link className="text-link" href="/evaluation?tab=sus">
                {t('fillSus')}
              </Link>
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
export function PrintDocument({ id }: { id: string }) {
  const t = useTranslations();
  const services = useServices();
  const { data, error, busy } = useAsyncData(() => services.documents.getDocument(id), [id]);
  useEffect(() => {
    if (data) {
      const timer = setTimeout(() => window.print(), 700);
      return () => clearTimeout(timer);
    }
  }, [data]);
  if (error) return <ErrorState error={error} />;
  if (busy || !data) return <Loading />;
  return (
    <>
      <div className="print-actions">
        <Button variant="primary" onClick={() => window.print()}>
          <FileText />
          {t('print')}
        </Button>
      </div>
      <main className="print-document">
        <h1>
          Software Requirements Specification
          <br />
          {data.metadata.title}
        </h1>
        {ieeeTemplate.chapters.map((c) => (
          <section key={c.number}>
            <h2>
              {c.number}. {c.title}
            </h2>
            {data.sections
              .filter((s) => s.number.startsWith(c.number + '.'))
              .map((s) => (
                <section key={s.id}>
                  <h3>
                    {s.number} {s.title}
                  </h3>
                  <Markdown text={s.markdown} />
                </section>
              ))}
          </section>
        ))}
      </main>
    </>
  );
}
