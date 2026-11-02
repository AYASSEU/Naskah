'use client';
import { useState, useEffect, useRef } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import * as Tabs from '@radix-ui/react-tabs';
import { z } from 'zod';
import { RougeSchema, StatisticalResultSchema } from '@naskah/contracts';
import { Download, Upload, Check } from 'lucide-react';
import { useServices, useAsyncData, ErrorState, Loading, useToast } from '@/shared/lib/providers';
import { Button } from '@/shared/ui';
import { Markdown } from '@/shared/ui/markdown';
import { downloadData } from '@/shared/lib/download';
import { scoreSus, statistics } from '@/entities/evaluation/sus';
import { parseRougeImport } from '@/entities/evaluation/rouge';
import items from '@/shared/i18n/sus-items.json';
function Rating({
  name,
  value,
  onChange,
  required = true,
}: {
  name: string;
  value: number;
  onChange: (value: number) => void;
  required?: boolean;
}) {
  return (
    <div className="rating" role="radiogroup" aria-label={name}>
      {[1, 2, 3, 4, 5].map((n) => (
        <label key={n}>
          <input
            type="radio"
            name={name}
            value={n}
            checked={value === n}
            onChange={() => onChange(n)}
            required={required}
            aria-label={`${name}: ${n}`}
          />
          <span>{n}</span>
        </label>
      ))}
    </div>
  );
}
export function Evaluation() {
  const t = useTranslations();
  const locale = useLocale();
  const services = useServices();
  const toast = useToast();
  const [tab, setTab] = useState('summary');
  const [answers, setAnswers] = useState<number[]>(Array(10).fill(0));
  const [comment, setComment] = useState('');
  const [expertComment, setExpertComment] = useState('');
  const [mobile, setMobile] = useState(false);
  const [susStep, setSusStep] = useState(0);
  const [score, setScore] = useState<number>();
  const [reviewer, setReviewer] = useState('');
  const [label, setLabel] = useState<'A' | 'B'>('A');
  const [reviewValues, setReviewValues] = useState({
    A: { ratings: [0, 0, 0, 0], justifications: ['', '', '', ''] },
    B: { ratings: [0, 0, 0, 0], justifications: ['', '', '', ''] },
  });
  const [reviewSaved, setReviewSaved] = useState(false);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const statsInput = useRef<HTMLInputElement>(null);
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const { data, error, busy, refresh } = useAsyncData(async () => {
    const [logs, reviews, sus, rouge, projects, blindDocuments, statisticsResults] =
      await Promise.all([
        services.evaluation.listGenerationLogs(),
        services.evaluation.listExpertReviews(),
        services.evaluation.listSusResponses(),
        services.evaluation.listRougeResults(),
        services.projects.list(),
        services.examples.getBlindDocuments(),
        services.evaluation.listStatisticalResults(),
      ]);
    const doc = projects[0] ? await services.documents.getDocument(projects[0].id) : undefined;
    return { logs, reviews, sus, rouge, doc, blindDocuments, statisticsResults };
  }, []);
  useEffect(() => {
    const initial = new URLSearchParams(window.location.search).get('tab');
    if (initial) setTab(initial);
  }, []);
  useEffect(() => {
    const query = window.matchMedia('(max-width:639px)');
    const update = () => setMobile(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  function changeTab(value: string) {
    setTab(value);
    setFormError('');
    window.history.replaceState(null, '', `/evaluation?tab=${value}`);
  }
  async function submitSus() {
    setFormBusy(true);
    setFormError('');
    try {
      const result = scoreSus(answers);
      await services.evaluation.saveSusResponse({
        id: crypto.randomUUID(),
        answers,
        score: result,
        comment,
        createdAt: new Date().toISOString(),
      });
      setScore(result);
      await refresh();
      toast(t('submitted'));
    } catch {
      setFormError(t('storageError'));
    } finally {
      setFormBusy(false);
    }
  }
  async function submitReview() {
    setFormBusy(true);
    setFormError('');
    try {
      await services.evaluation.saveExpertReview({
        id: crypto.randomUUID(),
        reviewer,
        label,
        ...reviewValues[label],
        comments: expertComment,
        createdAt: new Date().toISOString(),
      });
      setMapping(await services.examples.getBlindMapping());
      setReviewSaved(true);
      await refresh();
      toast(t('reviewSaved'));
    } catch {
      setFormError(t('storageError'));
    } finally {
      setFormBusy(false);
    }
  }
  async function importRouge(file: File) {
    try {
      const results = parseRougeImport(
        await file.text(),
        file.name.endsWith('.csv') ? 'csv' : 'json',
      );
      await services.evaluation.importRougeResults(results);
      await refresh();
    } catch {
      setFormError(t('importError'));
    }
  }
  async function sample() {
    const response = await fetch('/samples/rouge-results.json');
    await services.evaluation.importRougeResults(z.array(RougeSchema).parse(await response.json()));
    await refresh();
  }
  if (error) return <ErrorState error={error} retry={refresh} />;
  if (busy || !data) return <Loading />;
  const { logs, reviews, sus, rouge } = data;
  const dimensions = ['unambiguous', 'complete', 'correct', 'verifiable'];
  const currentReview = reviewValues[label];
  return (
    <main className="page evaluation-page">
      <div className="page-heading">
        <div>
          <h1>{t('evaluationTitle')}</h1>
          <p>{t('evaluationDescription')}</p>
        </div>
      </div>
      <Tabs.Root value={tab} onValueChange={changeTab}>
        <Tabs.List className="evaluation-tabs" aria-label={t('evaluation')}>
          {['summary', 'expert', 'sus', 'rouge'].map((v) => (
            <Tabs.Trigger key={v} value={v}>
              {t(v)}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        <Tabs.Content value="summary">
          <div className="evaluation-metrics">
            <div className="metric">
              <label>{t('successRate')}</label>
              <strong>
                {(
                  (logs.filter((l) => l.status === 'success').length / Math.max(logs.length, 1)) *
                  100
                ).toFixed(1)}
                <small>%</small>
              </strong>
            </div>
            <div className="metric">
              <label>{t('meanDuration')}</label>
              <strong>
                {statistics(logs.map((l) => l.execution_time_seconds)).mean.toFixed(1)}
                <small>s</small>
              </strong>
            </div>
            <div className="metric">
              <label>{t('meanCompleteness')}</label>
              <strong>
                {statistics(logs.map((l) => l.structure_completeness_pct)).mean.toFixed(1)}
                <small>%</small>
              </strong>
            </div>
          </div>
          <div className="evaluation-tools">
            <p className="help-note">{t('sampleData')}</p>
            <div>
              <Button onClick={() => downloadData(logs, 'generation-logs', 'csv')}>
                <Download />
                {t('exportCsv')}
              </Button>
              <Button onClick={() => downloadData(logs, 'generation-logs', 'json')}>
                {t('exportJson')}
              </Button>
            </div>
          </div>
          <div className="table-scroll">
            <table className="evaluation-table">
              <thead>
                <tr>
                  <th>{t('scenario')}</th>
                  <th>{t('domain')}</th>
                  <th>{t('status')}</th>
                  <th>{t('duration')}</th>
                  <th>{t('completeness')}</th>
                </tr>
              </thead>
              <tbody>
                {[...logs].reverse().map((log, i) => (
                  <tr key={`${log.session_id}-${i}`}>
                    <td>{log.project_title}</td>
                    <td>{log.domain}</td>
                    <td>
                      <span
                        className={`status ${log.status === 'success' ? 'status-finalized' : 'status-failed'}`}
                      >
                        <span />
                        {t(log.status === 'success' ? 'finalized' : 'failed')}
                      </span>
                    </td>
                    <td>{log.execution_time_seconds.toFixed(1)} s</td>
                    <td>{log.structure_completeness_pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Tabs.Content>
        <Tabs.Content value="expert">
          <input
            type="file"
            accept=".json"
            className="sr-only"
            ref={statsInput}
            onChange={async (e) => {
              try {
                const file = e.target.files?.[0];
                if (file) {
                  await services.evaluation.importStatisticalResults(
                    z.array(StatisticalResultSchema).parse(JSON.parse(await file.text())),
                  );
                  await refresh();
                }
              } catch {
                setFormError(t('importError'));
              }
            }}
          />
          <div className="evaluation-tools">
            <p className="help-note">{t('blindNote')}</p>
            <div>
              <Button onClick={() => downloadData(reviews, 'expert-reviews', 'csv')}>
                {t('exportCsv')}
              </Button>
              <Button onClick={() => downloadData(reviews, 'expert-reviews', 'json')}>
                {t('exportJson')}
              </Button>
            </div>
          </div>
          <div className="expert-layout">
            <div className="blind-preview">
              <div style={{ display: 'flex', gap: 10 }}>
                {(['A', 'B'] as const).map((v) => (
                  <Button
                    key={v}
                    variant={label === v ? 'primary' : 'secondary'}
                    onClick={() => {
                      setLabel(v);
                      setReviewSaved(false);
                    }}
                  >
                    {t('blindDocument', { label: v })}
                  </Button>
                ))}
              </div>
              <h3>{t('blindDocument', { label })}</h3>
              {data.blindDocuments.length ? (
                <Markdown
                  text={data.blindDocuments.find((d) => d.label === label)?.markdown || ''}
                />
              ) : (
                <p>{t('empty')}</p>
              )}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void submitReview();
              }}
            >
              <label className="field">
                <span>{t('reviewer')}</span>
                <input required value={reviewer} onChange={(e) => setReviewer(e.target.value)} />
              </label>
              <p className="help-note">{t('ratingHelp')}</p>
              {dimensions.map((dim, i) => (
                <div className="expert-dimension" key={dim}>
                  <header>
                    <h3>{t(dim)}</h3>
                    <Rating
                      name={`${label}-${dim}`}
                      value={currentReview.ratings[i]!}
                      onChange={(n) =>
                        setReviewValues((old) => ({
                          ...old,
                          [label]: {
                            ...old[label],
                            ratings: old[label].ratings.map((v, index) => (index === i ? n : v)),
                          },
                        }))
                      }
                    />
                  </header>
                  <textarea
                    aria-label={`${t('justification')} ${t(dim)}`}
                    required
                    value={currentReview.justifications[i]}
                    onChange={(e) =>
                      setReviewValues((old) => ({
                        ...old,
                        [label]: {
                          ...old[label],
                          justifications: old[label].justifications.map((v, index) =>
                            index === i ? e.target.value : v,
                          ),
                        },
                      }))
                    }
                    placeholder={t('justification')}
                  />
                </div>
              ))}
              <label className="field">
                <span>{t('comments')}</span>
                <textarea
                  value={expertComment}
                  onChange={(e) => setExpertComment(e.target.value)}
                />
              </label>
              <Button variant="primary" type="submit" disabled={formBusy || reviewSaved}>
                {reviewSaved ? <Check /> : null}
                {t(reviewSaved ? 'reviewSaved' : 'submitReview')}
              </Button>
              {reviewSaved && (
                <p className="help-note" style={{ marginTop: 15 }}>
                  {label}: {t(mapping[label] || 'system_simulated')}
                </p>
              )}
            </form>
          </div>
          {reviews.length > 0 && (
            <section style={{ marginTop: 40 }}>
              <h2>
                {t('submitted')} ({reviews.length})
              </h2>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>{t('blindDocument', { label: 'A / B' })}</th>
                      {dimensions.map((d) => (
                        <th key={d}>{t(d)} (mean / median / SD)</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(['A', 'B'] as const).map((label) => (
                      <tr key={label}>
                        <td>{label}</td>
                        {dimensions.map((dim, i) => {
                          const stats = statistics(
                            reviews.filter((r) => r.label === label).map((r) => r.ratings[i]!),
                          );
                          return (
                            <td key={dim}>
                              {stats.mean.toFixed(2)} / {stats.median.toFixed(2)} /{' '}
                              {stats.sd.toFixed(2)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="help-note">
                Wilcoxon signed-rank / Mann–Whitney U: evaluation-scripts/README.md
              </p>
              <Button onClick={() => statsInput.current?.click()}>{t('importStatistics')}</Button>
              {data.statisticsResults.map((result, i) => (
                <p className="help-note" key={i}>
                  {result.test} / {result.dimension}: n={result.n}, W/U={result.statistic}, p=
                  {result.p_value}, effect={result.effect_size}
                </p>
              ))}
            </section>
          )}
        </Tabs.Content>
        <Tabs.Content value="sus">
          <div className="evaluation-tools">
            <p className="help-note">{t('susDescription')}</p>
            <div>
              <Button onClick={() => downloadData(sus, 'sus-responses', 'csv')}>
                {t('exportCsv')}
              </Button>
              <Button onClick={() => downloadData(sus, 'sus-responses', 'json')}>
                {t('exportJson')}
              </Button>
            </div>
          </div>
          {score !== undefined ? (
            <div className="result-panel">
              <h2>{t('susResult')}</h2>
              <strong>
                {score.toFixed(1)}
                <span className="muted" style={{ fontSize: 20 }}>
                  {' '}
                  / 100
                </span>
              </strong>
              <p>{t('susBenchmark')}</p>
              <Button
                style={{ marginTop: 20 }}
                onClick={() => {
                  setScore(undefined);
                  setAnswers(Array(10).fill(0));
                  setSusStep(0);
                }}
              >
                {t('back')}
              </Button>
            </div>
          ) : (
            <form
              className="questionnaire"
              onSubmit={(e) => {
                e.preventDefault();
                void submitSus();
              }}
            >
              <div className="questionnaire-intro">
                <h2>System Usability Scale</h2>
                <p className="help-note">{t('susScale')}</p>
              </div>
              {items[locale === 'id' ? 'id' : 'en'].map(
                (question, i) =>
                  (!mobile || i === susStep) && (
                    <div className="question-row" key={i}>
                      <label>
                        <span className="question-number">{i + 1}.</span>
                        {question}
                      </label>
                      <Rating
                        name={`SUS ${i + 1}`}
                        value={answers[i]!}
                        onChange={(n) =>
                          setAnswers((old) => old.map((v, index) => (index === i ? n : v)))
                        }
                      />
                    </div>
                  ),
              )}
              {mobile && (
                <div className="sus-step-controls">
                  <Button
                    type="button"
                    disabled={susStep === 0}
                    onClick={() => setSusStep((step) => step - 1)}
                  >
                    {t('back')}
                  </Button>
                  <span>{susStep + 1} / 10</span>
                  {susStep < 9 && (
                    <Button
                      type="button"
                      variant="primary"
                      disabled={!answers[susStep]}
                      onClick={() => setSusStep((step) => step + 1)}
                    >
                      {t('next')}
                    </Button>
                  )}
                </div>
              )}
              {(!mobile || susStep === 9) && (
                <>
                  <label className="field">
                    <span>{t('comments')}</span>
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      rows={3}
                    />
                  </label>
                  <Button
                    variant="primary"
                    type="submit"
                    disabled={formBusy || answers.some((a) => a === 0)}
                  >
                    {t('submitSus')}
                  </Button>
                </>
              )}
            </form>
          )}
          <p className="help-note" style={{ marginTop: 25 }}>
            {t('susFootnote')}
          </p>
        </Tabs.Content>
        <Tabs.Content value="rouge">
          <div className="evaluation-tools">
            <p className="help-note">{t('rougeNote')}</p>
            <div>
              <Button onClick={() => downloadData(rouge, 'rouge-results', 'csv')}>
                {t('exportCsv')}
              </Button>
              <Button onClick={() => downloadData(rouge, 'rouge-results', 'json')}>
                {t('exportJson')}
              </Button>
            </div>
          </div>
          <input
            type="file"
            ref={fileInput}
            accept=".json,.csv"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void importRouge(file);
            }}
          />
          <div style={{ display: 'flex', gap: 10, marginBottom: 25 }}>
            <Button variant="primary" onClick={() => fileInput.current?.click()}>
              <Upload />
              {t('importResults')}
            </Button>
            <Button onClick={() => void sample()}>{t('loadSample')}</Button>
          </div>
          {rouge.length === 0 ? (
            <div className="empty-state" style={{ minHeight: 200 }}>
              <h2>{t('noRouge')}</h2>
            </div>
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>{t('scenario')}</th>
                    <th>ROUGE-1 (P / R / F1)</th>
                    <th>ROUGE-2 (P / R / F1)</th>
                    <th>ROUGE-L (P / R / F1)</th>
                  </tr>
                </thead>
                <tbody>
                  {rouge.map((row) => (
                    <tr key={row.scenario}>
                      <td>{row.scenario}</td>
                      {(['rouge1', 'rouge2', 'rougeL'] as const).map((metric) => (
                        <td key={metric}>
                          {row[metric].precision.toFixed(3)} / {row[metric].recall.toFixed(3)} /{' '}
                          {row[metric].f1.toFixed(3)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Tabs.Content>
      </Tabs.Root>
      {formError && (
        <p role="alert" className="inline-error">
          {formError}
        </p>
      )}
    </main>
  );
}
