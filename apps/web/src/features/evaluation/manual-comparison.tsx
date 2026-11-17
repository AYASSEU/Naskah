'use client';
import { useEffect, useId, useRef, useState } from 'react';
import {
  ArrowRight,
  Calculator,
  CheckCircle2,
  Download,
  FileText,
  LoaderCircle,
  Upload,
} from 'lucide-react';
import { parser } from '@/services/client/parser';
import { downloadData } from '@/shared/lib/download';
type Doc = { name: string; text: string; hash: string };
type Method = 'LLM-only' | 'LLM + RAG';
const metrics = ['precision', 'recall', 'f1'] as const;
type Run = {
  id: string;
  time: string;
  project: string;
  language: string;
  method: Method;
  baseline: string;
  candidate: string;
  baseHash: string;
  candidateHash: string;
  provenance: Record<string, string | number | boolean>;
  precision: number;
  recall: number;
  f1: number;
};
const prefix = 'sreques.bertscore.v1.';
const methods: Method[] = ['LLM-only', 'LLM + RAG'];
function FileSlot({
  label,
  doc,
  onChange,
  disabled,
}: {
  label: string;
  doc: Doc | null;
  onChange: (doc: Doc | null) => void;
  disabled: boolean;
}) {
  const version = useRef(0),
    mounted = useRef(true),
    [error, setError] = useState(''),
    [reading, setReading] = useState(false);
  const inputId = useId();
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  async function choose(file?: File) {
    const seq = ++version.current;
    onChange(null);
    setError('');
    setReading(false);
    if (!file) return;
    setReading(true);
    try {
      if (!/\.(pdf|txt)$/i.test(file.name) || file.size > 10 * 1024 * 1024)
        throw Error('Pilih PDF berisi teks atau TXT hingga 10 MB.');
      const { text } = await parser.extractText(file);
      if (!text)
        throw Error(
          'Teks tidak terbaca. Untuk dokumen hasil pindai, jalankan OCR terlebih dahulu.',
        );
      if (text.length > 100000) throw Error('Teks melebihi batas 100.000 karakter.');
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
      const hash = Array.from(new Uint8Array(digest), (v) => v.toString(16).padStart(2, '0')).join(
        '',
      );
      if (mounted.current && seq === version.current) onChange({ name: file.name, text, hash });
    } catch (e) {
      if (mounted.current && seq === version.current)
        setError(e instanceof Error ? e.message : 'Dokumen gagal dibaca.');
    } finally {
      if (mounted.current && seq === version.current) setReading(false);
    }
  }
  return (
    <div className="bert-file-slot">
      <div className={`bert-upload${doc ? ' has-document' : ''}${error ? ' has-error' : ''}`}>
        <input
          id={inputId}
          aria-label={label}
          aria-describedby={`${inputId}-help${error ? ` ${inputId}-error` : ''}`}
          aria-invalid={!!error}
          type="file"
          accept=".txt,.pdf"
          disabled={disabled}
          onChange={(e) => void choose(e.target.files?.[0])}
        />
        <label htmlFor={inputId}>
          <span className="bert-upload-icon" aria-hidden="true">
            {reading ? <LoaderCircle className="bert-spinning" /> : doc ? <FileText /> : <Upload />}
          </span>
          <strong className="bert-filename">
            {reading ? 'Membaca dokumen…' : (doc?.name ?? 'Pilih dokumen')}
          </strong>
          <span id={`${inputId}-help`}>
            {doc
              ? `${doc.text.length.toLocaleString('id-ID')} karakter terbaca`
              : 'PDF berisi teks atau TXT · Maks. 10 MB'}
          </span>
          <span className="bert-file-action">
            {doc ? 'Ganti dokumen' : 'Jelajahi file'}
            <ArrowRight aria-hidden="true" />
          </span>
        </label>
      </div>
      {error && (
        <p className="bert-error" id={`${inputId}-error`} role="alert">
          {error}
        </p>
      )}
      {doc && (
        <details className="bert-preview">
          <summary>Lihat teks yang terbaca</summary>
          <p>{doc.text}</p>
        </details>
      )}
    </div>
  );
}
function comparable(a: Run, b: Run) {
  return (
    a.project === b.project &&
    a.baseHash === b.baseHash &&
    a.language === b.language &&
    JSON.stringify(a.provenance) === JSON.stringify(b.provenance)
  );
}
function Results({ run, history }: { run: Run; history: Run[] }) {
  const options = history.filter((r) => r.method !== run.method && comparable(r, run));
  const [otherId, setOtherId] = useState(options[0]?.id ?? '');
  const other = options.find((r) => r.id === otherId);
  const rows = other
    ? [run, other].sort((a, b) => methods.indexOf(a.method) - methods.indexOf(b.method))
    : [run];
  function exportCsv() {
    const safe = (s: string) => (/^[=+@\-\t\r]/.test(s) ? "'" + s : s);
    downloadData(
      rows.map((r) => ({
        Proyek: r.project,
        Metode: r.method,
        Baseline: safe(r.baseline),
        Pembanding: safe(r.candidate),
        Bahasa: r.language,
        Waktu: r.time,
        SHA256_baseline: r.baseHash,
        SHA256_pembanding: r.candidateHash,
        Precision: r.precision,
        Recall: r.recall,
        F1: r.f1,
        ...r.provenance,
      })),
      'bertscore-' + run.project,
      'csv',
    );
  }
  return (
    <section className="bert-results" aria-label="Hasil BERTScore">
      <div className="bert-section-heading">
        <div>
          <h2>Hasil perbandingan</h2>
          <p>
            Proyek {run.project} · Baseline {run.baseline} · {run.language.toUpperCase()}
          </p>
        </div>
        <button className="bert-secondary" onClick={exportCsv}>
          <Download aria-hidden="true" />
          Unduh CSV BERTScore
        </button>
      </div>
      {options.length > 0 && (
        <label>
          Pasangan metode lain
          <select value={otherId} onChange={(e) => setOtherId(e.target.value)}>
            <option value="">Tampilkan satu hasil</option>
            {options.map((r) => (
              <option key={r.id} value={r.id}>
                {r.method} · {r.candidate} · {new Date(r.time).toLocaleString('id-ID')}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="bert-scorecards">
        {rows.map((r) => (
          <div className="bert-scorecard" key={r.id}>
            <span>{r.method}</span>
            <p>
              <strong>{r.f1.toFixed(4)}</strong>
              <span>F1</span>
            </p>
            <span className="bert-filename">{r.candidate}</span>
          </div>
        ))}
      </div>
      <div className="bert-table-scroll" role="region" aria-label="Rincian skor" tabIndex={0}>
        <table>
          <thead>
            <tr>
              {['Metode', 'SRS pembanding', 'F1', 'Precision', 'Recall'].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <th>{r.method}</th>
                <td>{r.candidate}</td>
                <td>
                  <strong>{r.f1.toFixed(4)}</strong>
                </td>
                <td>{r.precision.toFixed(4)}</td>
                <td>{r.recall.toFixed(4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="bert-chart" aria-label="Grafik perbandingan skor">
        {metrics.map((m) => (
          <div key={m}>
            <strong>{m.toUpperCase()}</strong>
            {rows.map((r) => (
              <div className="bert-bar" key={r.id}>
                <span>{r.method}</span>
                <span className="bert-track">
                  <i
                    style={{
                      width: Math.max(0, Math.min(100, r[m] * 100)) + '%',
                      background: r.method === 'LLM-only' ? 'var(--ink-3)' : 'var(--gold)',
                    }}
                  />
                </span>
                <span>{r[m].toFixed(4)}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
      {other && (
        <p className="bert-difference">
          Selisih F1 (LLM + RAG dikurangi LLM-only):{' '}
          <strong>{(rows[1]!.f1 - rows[0]!.f1).toFixed(4)}</strong>
        </p>
      )}
    </section>
  );
}
export function ManualComparison() {
  const [project, setProject] = useState('A'),
    [method, setMethod] = useState<Method>('LLM-only'),
    [baseline, setBaseline] = useState<Doc | null>(null),
    [candidate, setCandidate] = useState<Doc | null>(null),
    [baseLang, setBaseLang] = useState('id'),
    [candLang, setCandLang] = useState('id'),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [history, setHistory] = useState<Run[]>([]),
    [selected, setSelected] = useState(''),
    [slot, setSlot] = useState(0);
  useEffect(() => {
    try {
      const runs = Object.keys(localStorage)
        .filter((k) => k.startsWith(prefix))
        .map((k) => JSON.parse(localStorage.getItem(k)!) as Run)
        .sort((a, b) => b.time.localeCompare(a.time));
      setHistory(runs);
      setSelected(runs[0]?.id ?? '');
    } catch {
      setMessage('Riwayat lokal tidak dapat dibaca.');
    }
  }, []);
  const current = history.find((r) => r.id === selected);
  async function calculate() {
    if (!baseline || !candidate || busy || baseLang !== candLang) return;
    setBusy(true);
    setMessage('Menghitung di Docker lokal…');
    try {
      const res = await fetch('/api/local-bertscore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Naskah-Client': 'web' },
        body: JSON.stringify({
          candidate: candidate.text,
          reference: baseline.text,
          language: baseLang,
        }),
      });
      const data = await res.json();
      if (!res.ok)
        throw Error(
          data.code === 'evaluation_too_large'
            ? 'Dokumen melebihi batas evaluator (8.192 subtoken per dokumen).'
            : data.code === 'evaluation_unavailable'
              ? 'Evaluator lokal belum siap. Jalankan Docker dan node scripts/local-evaluation.mjs.'
              : 'Penghitungan gagal: ' + data.code,
        );
      const run: Run = {
        id: crypto.randomUUID(),
        time: new Date().toISOString(),
        project,
        language: baseLang,
        method,
        baseline: baseline.name,
        candidate: candidate.name,
        baseHash: baseline.hash,
        candidateHash: candidate.hash,
        ...data,
      };
      setHistory((prev) => [run, ...prev]);
      setSelected(run.id);
      setMessage('Penghitungan selesai.');
      try {
        localStorage.setItem(prefix + run.id, JSON.stringify(run));
      } catch {
        setMessage(
          'Skor tersedia, tetapi riwayat gagal disimpan. Unduh CSV sebelum menutup halaman.',
        );
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Penghitungan gagal.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <section className="bert-comparison" aria-labelledby="bert-compare-title">
        <div className="bert-section-heading">
          <div>
            <h2 id="bert-compare-title">Bandingkan dokumen SRS</h2>
            <p>Gunakan dua dokumen dari brief proyek yang sama.</p>
          </div>
          <label className="bert-project">
            Kode proyek
            <select
              disabled={busy}
              value={project}
              onChange={(e) => {
                setProject(e.target.value);
                setBaseline(null);
                setCandidate(null);
                setSlot((s) => s + 1);
              }}
            >
              {['A', 'B', 'C'].map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="bert-document-grid">
          <fieldset className="bert-document" disabled={busy}>
            <legend>Baseline manusia</legend>
            <p className="bert-document-note">Dokumen acuan untuk kedua metode.</p>
            <FileSlot
              key={project}
              label="SRS baseline manusia"
              doc={baseline}
              onChange={setBaseline}
              disabled={busy}
            />
            <div className="bert-document-controls">
              <label>
                Bahasa baseline
                <select value={baseLang} onChange={(e) => setBaseLang(e.target.value)}>
                  <option value="id">Indonesia</option>
                  <option value="en">English</option>
                </select>
              </label>
            </div>
          </fieldset>
          <fieldset className="bert-document" disabled={busy}>
            <legend>Dokumen pembanding</legend>
            <p className="bert-document-note">SRS hasil LLM-only atau LLM + RAG.</p>
            <FileSlot
              key={slot}
              label="SRS pembanding"
              doc={candidate}
              onChange={setCandidate}
              disabled={busy}
            />
            <div className="bert-document-controls">
              <label>
                Metode pembanding
                <select value={method} onChange={(e) => setMethod(e.target.value as Method)}>
                  {methods.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </label>
              <label>
                Bahasa pembanding
                <select value={candLang} onChange={(e) => setCandLang(e.target.value)}>
                  <option value="id">Indonesia</option>
                  <option value="en">English</option>
                </select>
              </label>
            </div>
          </fieldset>
        </div>
        {baseLang !== candLang && (
          <p className="bert-error" role="alert">
            Pilih dua dokumen dengan bahasa yang sama.
          </p>
        )}
        <div className="bert-actionbar">
          <div className="bert-readiness">
            {baseline && candidate ? (
              <CheckCircle2 aria-hidden="true" />
            ) : (
              <FileText aria-hidden="true" />
            )}
            <span>
              {baseline && candidate
                ? 'Kedua dokumen siap dibandingkan'
                : 'Pilih baseline dan dokumen pembanding.'}
            </span>
          </div>
          <button
            className="bert-primary"
            disabled={busy || !baseline || !candidate || baseLang !== candLang}
            onClick={calculate}
          >
            {busy ? (
              <LoaderCircle className="bert-spinning" aria-hidden="true" />
            ) : (
              <Calculator aria-hidden="true" />
            )}
            Hitung BERTScore lokal
          </button>
        </div>
        {message && (
          <output className="bert-message" aria-live="polite">
            {message}
          </output>
        )}
        {current && baseline?.hash === current.baseHash && project === current.project && (
          <button
            className="bert-secondary"
            disabled={busy}
            onClick={() => {
              setMethod(current.method === methods[0] ? methods[1]! : methods[0]!);
              setCandidate(null);
              setSlot((s) => s + 1);
              setMessage('Pilih dokumen pembanding untuk metode berikutnya.');
            }}
          >
            Bandingkan metode lain
            <ArrowRight aria-hidden="true" />
          </button>
        )}
      </section>
      {history.length > 0 && (
        <label className="bert-history">
          Riwayat hasil
          <select value={selected} onChange={(e) => setSelected(e.target.value)}>
            {history.map((r) => (
              <option key={r.id} value={r.id}>
                {r.project} · {r.method} · {r.candidate} ·{' '}
                {new Date(r.time).toLocaleString('id-ID')}
              </option>
            ))}
          </select>
        </label>
      )}
      {current && <Results key={current.id} run={current} history={history} />}
    </>
  );
}
