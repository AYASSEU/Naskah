'use client';
import { useState, type FormEvent } from 'react';
export function ManualComparison() {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setMessage('Menghitung di evaluator lokal…');
    try {
      const response = await fetch('/api/local-bertscore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Naskah-Client': 'web' },
        body: JSON.stringify(Object.fromEntries(data)),
      });
      const result = await response.json();
      if (!response.ok)
        throw Error(
          result.code === 'evaluation_unavailable'
            ? 'Evaluator lokal belum siap. Jalankan Docker dan node scripts/local-evaluation.mjs.'
            : 'Penghitungan gagal: ' + result.code,
        );
      setMessage(
        'Precision ' +
          result.precision.toFixed(4) +
          ' · Recall ' +
          result.recall.toFixed(4) +
          ' · F1 ' +
          result.f1.toFixed(4),
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Evaluator tidak dapat dihubungi.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} onChange={() => setMessage('')}>
      <h2>Bandingkan dua teks</h2>
      <label>
        Bahasa kedua teks
        <select disabled={busy} name="language">
          <option value="id">Indonesia</option>
          <option value="en">English</option>
        </select>
      </label>
      <label>
        Teks kandidat
        <textarea disabled={busy} required maxLength={100000} name="candidate" rows={5} />
      </label>
      <label>
        Teks referensi
        <textarea disabled={busy} required maxLength={100000} name="reference" rows={5} />
      </label>
      <button disabled={busy}>Hitung BERTScore lokal</button>
      <output aria-live="polite">{message}</output>
    </form>
  );
}
