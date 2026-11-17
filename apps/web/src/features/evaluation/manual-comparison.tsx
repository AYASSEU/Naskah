'use client';
import { useEffect, useRef, useState } from 'react';
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
    [error, setError] = useState('');
  async function choose(file?: File) {
    const seq = ++version.current;
    onChange(null);
    setError('');
    if (!file) return;
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
      if (seq === version.current) onChange({ name: file.name, text, hash });
    } catch (e) {
      if (seq === version.current)
        setError(e instanceof Error ? e.message : 'Dokumen gagal dibaca.');
    }
  }
  return (
    <div>
      <label>
        {label}
        <input
          type="file"
          accept=".txt,.pdf"
          disabled={disabled}
          onChange={(e) => void choose(e.target.files?.[0])}
        />
      </label>
      {error && <p role="alert">{error}</p>}
      {doc && (
        <details>
          <summary>Pratinjau · {doc.text.length.toLocaleString('id-ID')} karakter</summary>
          <p style={{ whiteSpace: 'pre-wrap', maxHeight: 220, overflow: 'auto' }}>{doc.text}</p>
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
    <section>
      <h2>Hasil proyek {run.project}</h2>
      <p>
        {run.baseline} · {run.language.toUpperCase()}
      </p>
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
      <div className="study-scroll">
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
      <div className="bert-chart">
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
        <p>
          Selisih F1 (LLM + RAG dikurangi LLM-only):{' '}
          <strong>{(rows[1]!.f1 - rows[0]!.f1).toFixed(4)}</strong>
        </p>
      )}
      <button onClick={exportCsv}>Unduh CSV BERTScore</button>
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
      <section>
        <h2>Bandingkan dokumen SRS</h2>
        <label>
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
        <fieldset disabled={busy}>
          <FileSlot
            key={project}
            label="SRS baseline manusia"
            doc={baseline}
            onChange={setBaseline}
            disabled={busy}
          />
          <label>
            Bahasa baseline
            <select value={baseLang} onChange={(e) => setBaseLang(e.target.value)}>
              <option value="id">Indonesia</option>
              <option value="en">English</option>
            </select>
          </label>
        </fieldset>
        <fieldset disabled={busy}>
          <label>
            Metode pembanding
            <select value={method} onChange={(e) => setMethod(e.target.value as Method)}>
              {methods.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </label>
          <FileSlot
            key={slot}
            label="SRS pembanding"
            doc={candidate}
            onChange={setCandidate}
            disabled={busy}
          />
          <label>
            Bahasa pembanding
            <select value={candLang} onChange={(e) => setCandLang(e.target.value)}>
              <option value="id">Indonesia</option>
              <option value="en">English</option>
            </select>
          </label>
        </fieldset>
        {baseLang !== candLang && <p role="alert">Pilih dua dokumen dengan bahasa yang sama.</p>}
        <button
          disabled={busy || !baseline || !candidate || baseLang !== candLang}
          onClick={calculate}
        >
          Hitung BERTScore lokal
        </button>
        <output aria-live="polite">{message}</output>
        {current && baseline?.hash === current.baseHash && project === current.project && (
          <button
            disabled={busy}
            onClick={() => {
              setMethod(current.method === methods[0] ? methods[1]! : methods[0]!);
              setCandidate(null);
              setSlot((s) => s + 1);
              setMessage('Pilih dokumen pembanding untuk metode berikutnya.');
            }}
          >
            Bandingkan metode lain
          </button>
        )}
      </section>
      {history.length > 0 && (
        <label>
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
