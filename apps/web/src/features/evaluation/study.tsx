'use client';
import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { scoreSus } from '@/entities/evaluation/sus';
import instrument from './instrument.json';
import { sessions, update, type Session, type Review } from './session-store';
import './study.css';

const dimensions = ['Unambiguous', 'Complete', 'Correct', 'Verifiable'];
const scores = [1, 2, 3, 4, 5];
function Matrix({
  title,
  labels,
  prefix,
  sus = false,
}: {
  title: string;
  labels: string[];
  prefix: string;
  sus?: boolean;
}) {
  return (
    <div className="study-scroll">
      <table>
        <caption>{title}</caption>
        <thead>
          <tr>
            {sus && <th rowSpan={2}>No</th>}
            <th rowSpan={2}>{sus ? 'Pertanyaan' : 'Dimensi'}</th>
            <th colSpan={5}>Skor</th>
          </tr>
          <tr>
            {scores.map((n) => (
              <th key={n}>{n}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {labels.map((label, i) => (
            <tr key={label}>
              {sus && <td>{i + 1}</td>}
              <th scope="row">{label}</th>
              {scores.map((n) => (
                <td key={n}>
                  <input
                    required
                    type="radio"
                    name={prefix + i}
                    value={n}
                    aria-label={title + ' · ' + label + ' · ' + n}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={sus ? 7 : 6}>
              {(sus ? instrument.feedback : ['Catatan/Temuan']).map((label, i) => (
                <label key={label}>
                  {label}
                  <textarea name={prefix + 'comment' + i} />
                </label>
              ))}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
const docCode = (project: string, i: number) => project + '0' + (i + 1);
function downloadCsv(filename: string, header: string[], rows: string[][]) {
  const escape = (v: string) =>
    '"' + (/^[=+@\-\t\r]/.test(v) ? "'" : '') + v.replaceAll('"', '""') + '"';
  const url = URL.createObjectURL(
    new Blob(['\ufeff' + [header, ...rows].map((row) => row.map(escape).join(',')).join('\r\n')], {
      type: 'text/csv;charset=utf-8',
    }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function SusResults({ items }: { items: Session[] }) {
  const responses = items.flatMap((s) => s.reviews.filter((r) => r.sus).map((r) => ({ s, r })));
  const rows = responses.map(({ s, r }) => [
    s.name,
    r.initials,
    ...r.sus!.answers.map(String),
    ...r.sus!.feedback,
    String(r.sus!.score),
  ]);
  const headers = [
    'Sesi',
    'Inisial peserta',
    ...instrument.questions,
    ...instrument.feedback,
    'Skor SUS',
  ];
  return (
    <section aria-label="Rata-rata SUS">
      <h3>Rata-rata SUS</h3>
      {responses.length ? (
        <>
          <strong>
            {(
              responses.reduce((sum, { r }) => sum + r.sus!.score, 0) / responses.length
            ).toLocaleString('id-ID', { maximumFractionDigits: 2 })}
            /100
          </strong>
          <span>{responses.length} respons lengkap</span>
          <button onClick={() => downloadCsv('hasil-sus.csv', headers, rows)}>Unduh CSV SUS</button>
        </>
      ) : (
        <p>Belum ada respons SUS.</p>
      )}
      {responses.length > 0 && (
        <details>
          <summary>Lihat rincian SUS</summary>
          <div
            className="study-scroll sus-scroll"
            role="region"
            aria-label="Tabel rincian SUS"
            tabIndex={0}
          >
            <table>
              <thead>
                <tr>
                  {[
                    'Sesi',
                    'Inisial peserta',
                    ...instrument.questions,
                    ...instrument.feedback,
                    'Skor SUS',
                  ].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {responses.map(({ s, r }) => (
                  <tr key={r.id}>
                    <td>{s.name}</td>
                    <td>{r.initials}</td>
                    {[...r.sus!.answers, ...r.sus!.feedback, r.sus!.score].map((v, i) => (
                      <td key={i}>{v}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </section>
  );
}
function Results({ items, project }: { items: Session[]; project: string }) {
  const reviews = items.flatMap((s) =>
    s.reviews.filter((r) => r.project === project && r.ratings).map((r) => ({ s, r })),
  );
  if (!reviews.length)
    return (
      <>
        <p>Belum ada penilaian tersimpan untuk pilihan ini.</p>
        <SusResults items={items} />
      </>
    );
  const header = [
    'Sesi',
    'Proyek',
    'Inisial',
    'Profesi',
    'Tanggal',
    'Dokumen',
    'Dimensi',
    'Skor',
    'Catatan',
  ];
  const rows = reviews.flatMap(({ s, r }) =>
    r.ratings!.flatMap((ratings, i) =>
      ratings.map((n, j) => [
        s.name,
        project,
        r.initials,
        r.profession,
        r.date,
        docCode(project, i),
        dimensions[j]!,
        String(n),
        r.notes?.[i] ?? '',
      ]),
    ),
  );
  return (
    <>
      <h3>Hasil proyek {project}</h3>
      <p>
        {reviews.length} penilaian ·{' '}
        {reviews
          .map((x) => x.s.name)
          .filter((v, i, a) => a.indexOf(v) === i)
          .join(', ')}
      </p>
      <div className="study-scroll">
        <table>
          <caption>Rata-rata skor pakar</caption>
          <thead>
            <tr>
              <th>Dokumen</th>
              {dimensions.map((d) => (
                <th key={d}>{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[0, 1, 2].map((i) => (
              <tr key={i}>
                <th>{docCode(project, i)}</th>
                {dimensions.map((d, j) => (
                  <td key={d}>
                    {(
                      reviews.reduce((sum, { r }) => sum + r.ratings![i]![j]!, 0) / reviews.length
                    ).toFixed(2)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SusResults items={items} />
      <button onClick={() => downloadCsv('penilaian-' + project + '.csv', header, rows)}>
        Unduh rincian CSV
      </button>
      <div className="study-scroll">
        <table>
          <thead>
            <tr>
              {header.map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                {row.map((v, j) => (
                  <td key={j}>{v}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
export function Evaluation() {
  const [all, setAll] = useState<Session[]>([]),
    [active, setActive] = useState(''),
    [expert, setExpert] = useState(''),
    [view, setView] = useState('Ringkasan'),
    [step, setStep] = useState(1),
    [project, setProject] = useState('A'),
    [selected, setSelected] = useState<string[]>([]),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    sessions()
      .then(setAll)
      .catch(() => setError('Database penelitian tidak dapat dibuka.'));
  }, []);
  const session = all.find((s) => s.id === active),
    review = session?.reviews.find((r) => r.id === expert),
    completed = session?.reviews.filter((r) => r.ratings) ?? [];
  async function save(id: string, change: Parameters<typeof update>[1], after: () => void) {
    setError('');
    setBusy(true);
    try {
      await update(id, change);
      setAll(await sessions());
      after();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Penyimpanan gagal.');
    } finally {
      setBusy(false);
    }
  }
  function load(s: Session) {
    setActive(s.id);
    setSelected([s.id]);
    setExpert('');
    setStep(1);
    setView('Penilaian pakar');
  }
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget),
      val = (k: string) => String(data.get(k) ?? '').trim();
    if (!session) return;
    function edit(fn: (s: Session) => void, after: () => void) {
      void save(
        active,
        (s) => {
          if (!s) throw Error('Sesi sudah dihapus.');
          fn(s);
          return s;
        },
        after,
      );
    }
    if (view === 'Penilaian pakar' && step === 1) {
      const r: Review = {
        id: crypto.randomUUID(),
        initials: val('initials'),
        profession: val('profession'),
        date: val('date'),
        project,
      };
      if (!r.initials || !r.profession) {
        setError('Isi inisial dan profesi peserta.');
        return;
      }
      edit(
        (s) => s.reviews.push(r),
        () => {
          setExpert(r.id);
          setStep(2);
        },
      );
      return;
    }
    edit(
      (s) => {
        const r = s.reviews.find((x) => x.id === expert);
        if (!r) throw Error('Pilih pakar terlebih dahulu.');
        if (view === 'SUS') {
          if (!r.ratings || r.sus) throw Error('Respons SUS tidak dapat disimpan untuk pakar ini.');
          const answers = instrument.questions.map((_, i) => Number(val('sus' + i)));
          r.sus = {
            answers,
            score: scoreSus(answers),
            feedback: instrument.feedback.map((_, i) => val('suscomment' + i)),
          };
        } else {
          if (r.ratings) throw Error('Penilaian ini sudah tersimpan.');
          r.ratings = [0, 1, 2].map((i) => dimensions.map((_, j) => Number(val('doc' + i + j))));
          r.notes = [0, 1, 2].map((i) => val('doc' + i + 'comment0'));
        }
      },
      () => {
        setSelected([active]);
        if (view !== 'SUS') setView('Hasil');
      },
    );
  }
  const selector = (
    <label>
      Kode proyek
      <select value={project} onChange={(e) => setProject(e.target.value)}>
        {['A', 'B', 'C'].map((x) => (
          <option key={x}>{x}</option>
        ))}
      </select>
    </label>
  );
  return (
    <main className="study">
      <h1>Evaluasi penelitian</h1>
      <nav aria-label="Tahap penelitian">
        {['Ringkasan', 'Penilaian pakar', 'SUS', 'Hasil'].map((v) => (
          <button
            key={v}
            disabled={
              busy || (v === 'Penilaian pakar' && !session) || (v === 'SUS' && !completed.length)
            }
            aria-current={view === v ? 'page' : undefined}
            onClick={() => {
              setView(v);
              if (v === 'SUS') setExpert(completed[0]?.id ?? '');
              if (v === 'Penilaian pakar') {
                setExpert('');
                setStep(1);
              }
            }}
          >
            {v}
          </button>
        ))}
        <Link href="/evaluation/bertscore">Analisis BERTScore</Link>
      </nav>
      {error && <p role="alert">{error}</p>}
      {view === 'Ringkasan' && (
        <>
          <h2>Ringkasan</h2>
          <p>
            Materi uji terdiri dari tiga brief proyek dan sembilan SRS simulasi. Jawaban pakar di
            bawah berasal dari sesi pada browser ini.
          </p>
          <div className="study-scroll">
            <table>
              <caption>Materi uji tetap</caption>
              <thead>
                <tr>
                  <th>Kode proyek</th>
                  <th>Brief proyek</th>
                  <th>Dokumen simulasi</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries({
                  A: 'Perdagangan elektronik',
                  B: 'Manajemen pembelajaran',
                  C: 'Reservasi hotel',
                }).map(([code, title]) => (
                  <tr key={code}>
                    <th>{code}</th>
                    <td>
                      <a href={'/research/' + code + '/brief.pdf'} target="_blank" rel="noreferrer">
                        {title}
                      </a>
                    </td>
                    <td>
                      <nav>
                        {[0, 1, 2].map((i) => (
                          <a
                            key={i}
                            href={'/research/' + code + '/' + docCode(code, i) + '.pdf'}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {docCode(code, i)}
                          </a>
                        ))}
                      </nav>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>{' '}
          {selector}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const name = String(new FormData(e.currentTarget).get('name')).trim();
              if (!name) return;
              const s = { id: crypto.randomUUID(), name, reviews: [] };
              void save(
                s.id,
                () => s,
                () => load(s),
              );
            }}
          >
            <label>
              Nama sesi
              <input name="name" required maxLength={100} />
            </label>
            <button disabled={busy}>Mulai sesi penilaian</button>
          </form>
          {all.map((s) => (
            <section key={s.id}>
              <h3>{s.name}</h3>
              <p>{s.reviews.filter((r) => r.ratings).length} penilaian tersimpan</p>
              <button onClick={() => load(s)}>Muat sesi</button>{' '}
              <button
                disabled={busy}
                onClick={() => {
                  if (confirm('Hapus sesi “' + s.name + '” beserta seluruh jawabannya?'))
                    void save(
                      s.id,
                      () => null,
                      () => {
                        if (active === s.id) setActive('');
                      },
                    );
                }}
              >
                Hapus sesi
              </button>
            </section>
          ))}
          <Results items={all} project={project} />
        </>
      )}
      {view === 'Penilaian pakar' && session && (
        <section>
          <p>
            {session.name} · Bagian {step} dari 4
          </p>
          <h2>{instrument.title}</h2>
          <p>{instrument.study}</p>
          <strong>Tujuan Penilaian</strong>
          <p>{instrument.purpose}</p>
          {step === 1 && (
            <form onSubmit={submit}>
              <h3>Bagian 1. Identitas penilai</h3>
              {selector}
              <label>
                Inisial peserta
                <input required name="initials" maxLength={20} />
              </label>
              <label>
                Profesi peserta
                <input
                  required
                  name="profession"
                  list="profesi"
                  placeholder="Pilih atau tulis profesi lain"
                />
              </label>
              <datalist id="profesi">
                <option>System Analyst</option>
                <option>Technical Writer</option>
              </datalist>
              <label>
                Tanggal penilaian
                <input type="date" required name="date" />
              </label>
              <button disabled={busy}>Simpan identitas dan lanjutkan</button>
              {session.reviews
                .filter((r) => !r.ratings)
                .map((r) => (
                  <button
                    type="button"
                    key={r.id}
                    onClick={() => {
                      setExpert(r.id);
                      setProject(r.project);
                      setStep(2);
                    }}
                  >
                    Lanjutkan {r.initials} · {r.project} · {r.date}
                  </button>
                ))}
            </form>
          )}
          {step === 2 && (
            <>
              <h3>Bagian 2. Petunjuk pengisian</h3>
              <ol>
                {instrument.instructions.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ol>
              <table>
                <tbody>
                  {instrument.scale.map((row) => (
                    <tr key={row[0]}>
                      {row.map((x) => (
                        <td key={x}>{x}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <button onClick={() => setStep(3)}>Lanjut ke kriteria</button>
            </>
          )}
          {step === 3 && (
            <>
              <h3>Bagian 3. Ketentuan dimensi kualitas requirement</h3>
              <div className="study-scroll">
                <table>
                  <tbody>
                    {instrument.criteria.map(([title, ...cells]) => (
                      <tr key={title}>
                        <th>{title}</th>
                        {cells.map((c) => (
                          <td key={c}>{c}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button onClick={() => setStep(2)}>Kembali</button>{' '}
              <button onClick={() => setStep(4)}>Lanjut ke form penilaian</button>
            </>
          )}
          {step === 4 && review && (
            <form onSubmit={submit}>
              <h3>Bagian 4. Form penilaian</h3>
              <p>{instrument.prompt}</p>
              <a
                className="study-brief"
                href={'/research/' + review.project + '/brief.pdf'}
                target="_blank"
                rel="noreferrer"
              >
                Buka PDF brief proyek {review.project}
              </a>
              <nav>
                {[0, 1, 2].map((i) => (
                  <a
                    key={i}
                    href={'/research/' + review.project + '/' + docCode(review.project, i) + '.pdf'}
                    target="_blank"
                    rel="noreferrer"
                  >
                    SRS {docCode(review.project, i)} ↗
                  </a>
                ))}
              </nav>
              {[0, 1, 2].map((i) => (
                <Matrix
                  key={i}
                  title={'SRS ' + docCode(review.project, i)}
                  labels={dimensions}
                  prefix={'doc' + i}
                />
              ))}
              <button disabled={busy}>Simpan penelitian</button>
            </form>
          )}
        </section>
      )}
      {view === 'SUS' && (
        <section>
          <h2>System Usability Scale</h2>
          <label>
            Pakar
            <select value={expert} onChange={(e) => setExpert(e.target.value)}>
              {completed.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.initials} · {r.profession} · {r.date}
                </option>
              ))}
            </select>
          </label>
          {review?.sus ? (
            <p role="status">Skor SUS Anda: {review.sus.score}/100</p>
          ) : (
            <form key={expert} onSubmit={submit}>
              <p>1 Sangat Tidak Setuju · 2 Tidak Setuju · 3 Netral · 4 Setuju · 5 Sangat Setuju</p>
              <Matrix sus title="Form penilaian SUS" labels={instrument.questions} prefix="sus" />
              <button disabled={busy}>Simpan SUS</button>
            </form>
          )}
        </section>
      )}
      {view === 'Hasil' && (
        <section>
          <h2>Hasil penelitian</h2>
          {selector}
          <fieldset>
            <legend>Sesi yang ditampilkan</legend>
            {all.map((s) => (
              <label key={s.id}>
                <input
                  type="checkbox"
                  checked={selected.includes(s.id)}
                  onChange={(e) =>
                    setSelected(
                      e.target.checked ? [...selected, s.id] : selected.filter((x) => x !== s.id),
                    )
                  }
                />
                {s.name}
              </label>
            ))}
          </fieldset>
          <Results items={all.filter((s) => selected.includes(s.id))} project={project} />
        </section>
      )}
    </main>
  );
}
