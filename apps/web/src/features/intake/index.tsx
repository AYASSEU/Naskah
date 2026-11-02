'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Upload, FileText, X, FilePlus2 } from 'lucide-react';
import { useServices } from '@/shared/lib/providers';
import { PortError } from '@/services/ports';
import type { ParsedDocument } from '@/services/ports';
import { Button } from '@/shared/ui';
import { mergeSources } from '@/entities/document/cleaning';
export function Intake() {
  const t = useTranslations();
  const services = useServices();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState('');
  const [domain, setDomain] = useState('Healthcare');
  const [version, setVersion] = useState('0.1');
  const [notes, setNotes] = useState('');
  const [files, setFiles] = useState<ParsedDocument[]>([]);
  const [parsing, setParsing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('naskah-intake');
      if (raw) {
        const saved = JSON.parse(raw);
        setTitle(saved.title || '');
        setDomain(saved.domain || 'Healthcare');
        setNotes(saved.notes || '');
        setVersion(saved.version || '0.1');
        setFiles(saved.files || []);
      }
    } catch {
      /* Discard an invalid session draft and start clean. */
    }
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (hydrated)
      sessionStorage.setItem(
        'naskah-intake',
        JSON.stringify({ title, domain, version, notes, files }),
      );
  }, [title, domain, version, notes, files, hydrated]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if ((notes || files.length) && !busy) event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [notes, files, busy]);
  const corpus = mergeSources(notes, files);
  async function addFiles(selected: FileList | File[] | null) {
    if (!selected) return;
    setParsing(true);
    setError('');
    for (const f of Array.from(selected)) {
      try {
        const parsed = await services.parser.extractText(f);
        setFiles((old) => [...old.filter((item) => item.name !== f.name), parsed]);
      } catch (e) {
        setError(t(e instanceof PortError ? e.userMessage : 'invalidFile'));
      }
    }
    setParsing(false);
  }
  async function submit() {
    if (!title.trim() || !corpus.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      const p = await services.projects.create({
        title: title.trim(),
        domain,
        version,
        status: 'generating',
        rawText: corpus,
      });
      services.generation.start({
        session_id: p.sessionId,
        project_title: p.title,
        domain: p.domain,
        raw_text: corpus,
      });
      sessionStorage.removeItem('naskah-intake');
      router.push(`/workspace/${p.id}`);
    } catch (e) {
      setError(t(e instanceof PortError ? e.userMessage : 'storageError'));
      setBusy(false);
    }
  }
  return (
    <main className="page intake-page">
      <Link href="/" className="back-link">
        <ArrowLeft />
        {t('documents')}
      </Link>
      <div className="page-heading">
        <div>
          <h1>{t('newTitle')}</h1>
          <p>{t('newDescription')}</p>
        </div>
      </div>
      <div className="intake-layout">
        <aside className="intake-guidance">
          <h2>{t('guidanceTitle')}</h2>
          {[1, 2, 3].map((n) => (
            <div className="guidance-item" key={n}>
              <h3>{t(`guidance${n}`)}</h3>
              <p>{t(`guidance${n}Text`)}</p>
            </div>
          ))}
          <div className="guidance-standard">
            <span>830</span>
            <p className="help-note">
              {t('standard')}
              <br />
              {t('simulation')}
            </p>
          </div>
        </aside>
        <form
          className="intake-form"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div className="form-row three">
            <label className="field">
              <span>{t('title')}</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('titlePlaceholder')}
                required
              />
            </label>
            <label className="field">
              <span>{t('domain')}</span>
              <input
                list="domains"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                required
              />
              <datalist id="domains">
                {[
                  'Healthcare',
                  'Fintech',
                  'Education',
                  'E-commerce',
                  'Government',
                  'Logistics',
                ].map((d) => (
                  <option key={d} value={d} />
                ))}
              </datalist>
            </label>
            <label className="field">
              <span>{t('version')}</span>
              <input value={version} onChange={(e) => setVersion(e.target.value)} required />
            </label>
          </div>
          <div className="rule" />
          <label className="field">
            <span>{t('context')}</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('contextPlaceholder')}
              rows={8}
            />
          </label>
          <div className="field-count">
            <span>
              {notes.length.toLocaleString()} {t('characters')}
            </span>
            <Button
              type="button"
              variant="text"
              onClick={() =>
                void services.examples.listSamples().then((examples) => {
                  const example = examples[0];
                  if (example) {
                    setTitle(example.title);
                    setDomain(example.domain);
                    setNotes(example.rawText);
                  }
                })
              }
            >
              {t('sampleInput')}
            </Button>
          </div>
          <h3 className="section-label">
            {t('sources')}
            <span>({t('optional')})</span>
          </h3>
          <input
            ref={input}
            type="file"
            multiple
            accept=".pdf,.txt"
            className="sr-only"
            onChange={(e) => {
              void addFiles(e.target.files);
              e.target.value = '';
            }}
          />
          <button
            className="drop-zone"
            type="button"
            onClick={() => input.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void addFiles(e.dataTransfer.files);
            }}
          >
            <Upload />
            <span>{parsing ? t('loading') : t('dropzone')}</span>
            <small>{t('fileHelp')}</small>
          </button>
          {files.map((f, i) => (
            <div className="uploaded-file" key={f.name}>
              <div className="uploaded-file-top">
                <span className="text-link">
                  <FileText />
                  <span className="mono">{f.name}</span>
                </span>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`${t('delete')}: ${f.name}`}
                  onClick={() => setFiles((old) => old.filter((_, index) => index !== i))}
                >
                  <X />
                </button>
              </div>
              <p className="help-note">
                {(f.size / 1024).toFixed(1)} KB / {f.pages} {t('pages')} / {f.before} → {f.after}{' '}
                {t('characters')} / {f.removed} {t('linesRemoved')}
              </p>
              <details>
                <summary>{t('preview')}</summary>
                <textarea
                  aria-label={`${t('preview')}: ${f.name}`}
                  value={f.text}
                  onChange={(e) =>
                    setFiles((old) =>
                      old.map((file, index) =>
                        index === i ? { ...file, text: e.target.value } : file,
                      ),
                    )
                  }
                />
              </details>
            </div>
          ))}
          <div className="payload-summary">
            <span>
              <code>raw_text</code> · {corpus.length.toLocaleString()} {t('characters')}
            </span>
            <span>
              ~{Math.ceil(corpus.length / 4).toLocaleString()} {t('estimatedTokens')}
            </span>
          </div>
          {error && (
            <p className="inline-error" role="alert">
              {error}
            </p>
          )}
          <div className="form-submit">
            <Button
              type="submit"
              variant="primary"
              disabled={!title.trim() || !corpus.trim() || parsing || busy}
            >
              <FilePlus2 />
              {busy ? t('saving') : t('generate')}
            </Button>
            <p className="help-note">{t('inputNote')}</p>
          </div>
        </form>
      </div>
    </main>
  );
}
