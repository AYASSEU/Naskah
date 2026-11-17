'use client';
import { NavigationLink } from '@/shared/ui/navigation-link';
import { ArrowLeft } from 'lucide-react';
import { ManualComparison } from './manual-comparison';
import { useState } from 'react';
import type { EvaluationScope } from '@naskah/contracts';
import { useServices } from '@/shared/lib/providers';
import { useScopedData } from './scoped-data';
import './bertscore.css';

export function TextAnalysis() {
  const { research } = useServices();
  const [scope, setScope] = useState<EvaluationScope>('dev'),
    [caseId, setCaseId] = useState(''),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  const cases = useScopedData(
    async () => (research ? research.cases(scope) : []),
    [research, scope],
  );
  const current = cases.data?.find((c) => c.id === caseId);
  async function calculate() {
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/evaluation/bertscore?scope=' + scope, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Naskah-Client': 'web' },
        body: JSON.stringify({ caseId }),
      });
      const report = await response.json();
      if (!response.ok) throw Error(report.code);
      const { precision, recall, f1 } = report.results[0];
      setMessage(
        'Precision ' +
          precision.toFixed(4) +
          ' · Recall ' +
          recall.toFixed(4) +
          ' · F1 ' +
          f1.toFixed(4),
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Penghitungan gagal.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="bert-page">
      <NavigationLink className="bert-back" href="/evaluation" loadingLabel="Memuat evaluasi…">
        <ArrowLeft aria-hidden="true" />
        Evaluasi penelitian
      </NavigationLink>
      <header className="bert-page-heading">
        <h1>Analisis BERTScore</h1>
        <p>Ukur kemiripan SRS hasil AI dengan baseline manusia, lalu bandingkan kedua metode.</p>
      </header>
      <ManualComparison />
      <details className="bert-explanation">
        <summary>Cara membaca skor</summary>
        <p>
          F1 merangkum precision dan recall. Precision mengukur kecocokan token kandidat dengan
          referensi, sedangkan recall mengukur cakupan token referensi. Skor yang lebih tinggi
          menunjukkan kemiripan kontekstual yang lebih tinggi.
        </p>
        <p>
          Perhitungan berjalan di evaluator lokal dengan DistilBERT multilingual. Kedua dokumen
          harus menggunakan bahasa yang sama. Batas evaluator adalah 8.192 subtoken per dokumen.
        </p>
      </details>
      {research ? (
        <details className="bert-saved-cases">
          <summary>Bandingkan kasus tersimpan di backend</summary>
          <div>
            <label>
              Sumber kasus
              <select
                disabled={busy}
                value={scope}
                onChange={(e) => {
                  setScope(e.target.value as EvaluationScope);
                  setCaseId('');
                  setMessage('');
                }}
              >
                <option value="dev">Data uji</option>
                <option value="research">Data penelitian</option>
              </select>
            </label>
            <label>
              Kasus perbandingan
              <select
                disabled={busy}
                value={caseId}
                onChange={(e) => {
                  setCaseId(e.target.value);
                  setMessage('');
                }}
              >
                <option value="">Pilih kasus</option>
                {cases.data?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </label>
            {current && (
              <p>
                Bahasa kandidat: {current.language} · Bahasa referensi: {current.referenceLanguage}
              </p>
            )}
            {cases.error ? (
              <p role="alert">
                Data kasus gagal dimuat. <button onClick={cases.refresh}>Coba lagi</button>
              </p>
            ) : (
              cases.data?.length === 0 && <p>Belum ada kasus pada sumber ini.</p>
            )}
            <button
              disabled={busy || !current || current.language !== current.referenceLanguage}
              onClick={calculate}
            >
              {busy ? 'Menghitung…' : 'Hitung BERTScore'}
            </button>
            <output aria-live="polite">{message}</output>
            <a href={'/api/evaluation/export?scope=' + scope + '&format=csv&dataset=bertscore'}>
              Unduh CSV BERTScore
            </a>
          </div>
        </details>
      ) : null}
    </main>
  );
}
