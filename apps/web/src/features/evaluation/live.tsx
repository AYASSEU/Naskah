'use client';
import { useState, useEffect } from 'react';
import { useScopedData } from './scoped-data';
import { useTranslations, useLocale } from 'next-intl';
import * as Tabs from '@radix-ui/react-tabs';
import type { EvaluationScope, StatisticsReport } from '@naskah/contracts';
import { useServices, ErrorState, Loading } from '@/shared/lib/providers';
import { Button } from '@/shared/ui';
import { Markdown } from '@/shared/ui/markdown';
import { PortError } from '@/services/ports';
import items from '@/shared/i18n/sus-items.json';
const dimensions = ['unambiguous', 'complete', 'correct', 'verifiable'];
const emptyReview = () => ({ ratings: [0, 0, 0, 0], justifications: ['', '', '', ''] });
function Scale({
  name,
  value,
  onChange,
}: {
  name: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="rating" role="radiogroup" aria-label={name}>
      {[1, 2, 3, 4, 5].map((n) => (
        <label key={n}>
          <input
            type="radio"
            name={name}
            checked={n === value}
            value={n}
            required
            aria-label={`${name}: ${n}`}
            onChange={() => onChange(n)}
          />
          <span>{n}</span>
        </label>
      ))}
    </div>
  );
}
export function LiveEvaluation() {
  const services = useServices(),
    research = services.research!,
    t = useTranslations('researchEvaluation'),
    root = useTranslations(),
    locale = useLocale();
  const [scope, setScope] = useState<EvaluationScope>('dev'),
    [tab, setTab] = useState('summary'),
    [caseId, setCaseId] = useState(''),
    [design, setDesign] = useState<'paired' | 'independent'>('paired');
  const [code, setCode] = useState(''),
    [role, setRole] = useState<'expert' | 'participant'>('expert'),
    [consent, setConsent] = useState(false),
    [changePerson, setChangePerson] = useState(false);
  const [action, setAction] = useState(false),
    [formError, setFormError] = useState(''),
    [notice, setNotice] = useState('');
  const [label, setLabel] = useState<'A' | 'B'>('A'),
    [reviews, setReviews] = useState({ A: emptyReview(), B: emptyReview() }),
    [comment, setComment] = useState(''),
    [mapping, setMapping] = useState<Record<string, string>>({});
  const [answers, setAnswers] = useState<number[]>(Array(10).fill(0)),
    [susComment, setSusComment] = useState(''),
    [susScore, setSusScore] = useState<number>(),
    [projectId, setProjectId] = useState('');
  const [setup, setSetup] = useState(false),
    [caseTitle, setCaseTitle] = useState(''),
    [baseline, setBaseline] = useState(''),
    [referenceLanguage, setReferenceLanguage] = useState<'id' | 'en'>('id'),
    [provenance, setProvenance] = useState('');
  const [override, setOverride] = useState(false),
    [overrideReason, setOverrideReason] = useState(''),
    [stemmer, setStemmer] = useState(false);
  const [report, setReport] = useState<StatisticsReport>();
  const page = useScopedData(async () => {
    const [context, overview, cases, rouge, statistics] = await Promise.all([
      research.context(scope),
      research.overview(scope, design),
      research.cases(scope),
      research.rouge(scope),
      research.statistics(scope),
    ]);
    return { context, overview, cases, rouge, statistics };
  }, [scope, design]);
  const person = page.data?.context.scope === scope ? page.data.context.participant : null;
  const blind = useScopedData(
    async () => (person?.role === 'expert' && caseId ? research.blind(scope, caseId) : []),
    [scope, person?.code, person?.role, caseId],
  );
  useEffect(() => {
    const initial = new URLSearchParams(window.location.search).get('tab');
    if (initial) setTab(initial);
  }, []);
  useEffect(() => {
    if (page.data?.overview.scope !== scope) return;
    if (!page.data.cases.some((c) => c.id === caseId)) setCaseId(page.data.cases[0]?.id ?? '');
  }, [page.data, caseId, scope]);
  useEffect(() => {
    setReviews({ A: emptyReview(), B: emptyReview() });
    setMapping({});
    setComment('');
    setLabel('A');
    setAnswers(Array(10).fill(0));
    setSusScore(undefined);
  }, [person?.code, caseId, scope]);
  async function perform(operation: () => Promise<void>) {
    setAction(true);
    setFormError('');
    setNotice('');
    try {
      await operation();
    } catch (error) {
      setFormError(root(error instanceof PortError ? error.userMessage : 'backendErrors.unknown'));
    } finally {
      setAction(false);
    }
  }
  function exportData(
    dataset: 'logs' | 'reviews' | 'sus' | 'rouge' | 'statistics',
    format: 'csv' | 'json',
  ) {
    const a = window.document.createElement('a');
    a.href = research.exportUrl(scope, dataset, format, design);
    a.download = `naskah-${scope}-${dataset}.${format}`;
    a.click();
  }
  const exportButtons = (dataset: 'logs' | 'reviews' | 'sus' | 'rouge' | 'statistics') => (
    <div style={{ display: 'flex', gap: 10 }}>
      <Button onClick={() => exportData(dataset, 'csv')}>{root('exportCsv')}</Button>
      <Button onClick={() => exportData(dataset, 'json')}>{root('exportJson')}</Button>
    </div>
  );
  const num = (n: number | null | undefined) => (n == null ? '—' : n.toFixed(2));
  const scopeControl = (
    <div className="evaluation-tools">
      <label className="field">
        <span>{t('dataScope')}</span>
        <select
          aria-label={t('dataScope')}
          disabled={action || (!page.data && !page.previousData)}
          value={scope}
          onChange={(e) => {
            setScope(e.target.value as EvaluationScope);
            setCaseId('');
            setMapping({});
            setReport(undefined);
            setFormError('');
            setNotice('');
          }}
        >
          <option value="dev">{t('dev')}</option>
          <option value="research">{t('research')}</option>
        </select>
      </label>
      <p className="help-note" role="status">
        {t(scope === 'dev' ? 'devNotice' : 'researchNotice')}
      </p>
    </div>
  );
  if (page.error) return <ErrorState error={page.error} retry={page.refresh} />;
  if (!page.data || page.data.overview.scope !== scope || page.data.overview.design !== design)
    return (
      <main className="page evaluation-page">
        {scopeControl}
        <Loading />
      </main>
    );
  const data = page.data,
    currentCase = data.cases.find((c) => c.id === caseId),
    current = reviews[label],
    document = blind.data?.find((d) => d.label === label),
    complete = !!blind.data?.length && blind.data.every((d) => d.submitted);
  return (
    <main className="page evaluation-page">
      <div className="page-heading">
        <div>
          <h1>{root('evaluationTitle')}</h1>
          <p>{t('description')}</p>
        </div>
      </div>
      {scopeControl}
      <Tabs.Root
        value={tab}
        onValueChange={(value) => {
          setTab(value);
          setFormError('');
          window.history.replaceState(null, '', `/evaluation?tab=${value}`);
        }}
      >
        <Tabs.List className="evaluation-tabs" aria-label={root('evaluation')}>
          {['summary', 'expert', 'sus', 'rouge'].map((value) => (
            <Tabs.Trigger key={value} value={value}>
              {root(value)}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        <Tabs.Content value="summary">
          <div className="evaluation-metrics">
            <div className="metric">
              <label>{t('generationCount')}</label>
              <strong>{data.overview.counts.logs}</strong>
            </div>
            <div className="metric">
              <label>{root('meanDuration')}</label>
              <strong>
                {num(data.overview.duration.mean)}
                <small>s</small>
              </strong>
            </div>
            <div className="metric">
              <label>{root('meanCompleteness')}</label>
              <strong>
                {num(data.overview.completeness.mean)}
                <small>%</small>
              </strong>
            </div>
            <div className="metric">
              <label>{t('susCount')}</label>
              <strong>{data.overview.counts.sus}</strong>
            </div>
          </div>
          <p className="help-note">{t('excluded', { count: data.overview.counts.excludedDev })}</p>
          <div className="evaluation-tools">
            <p>{t('anonymousExports')}</p>
            {exportButtons('logs')}
          </div>
          {data.overview.counts.logs === 0 && <p>{t('emptyScope')}</p>}
        </Tabs.Content>
        {(tab === 'expert' || tab === 'sus') && (
          <section style={{ marginTop: 24, marginBottom: 24 }} aria-label={t('participant')}>
            {person && !changePerson ? (
              <>
                <p>
                  {t('activeParticipant', { code: person.code })} ·{' '}
                  {t(person.role === 'expert' ? 'expertRole' : 'participantRole')}
                </p>
                <Button
                  disabled={action}
                  onClick={() => {
                    setChangePerson(true);
                    setCode('');
                    setConsent(false);
                  }}
                >
                  {t('changeParticipant')}
                </Button>
              </>
            ) : (
              <form
                className="intake-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  void perform(async () => {
                    await research.consent(scope, { code, role, consent: true });
                    setChangePerson(false);
                    await page.refresh();
                  });
                }}
              >
                <h2>{t('participant')}</h2>
                <p className="help-note">{t('consentDescription')}</p>
                <div className="form-row">
                  <label className="field">
                    <span>{t('participantCode')}</span>
                    <input
                      required
                      pattern="[A-Za-z0-9_-]{3,40}"
                      maxLength={40}
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                    />
                  </label>
                  <label className="field">
                    <span>{t('role')}</span>
                    <select value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
                      <option value="expert">{t('expertRole')}</option>
                      <option value="participant">{t('participantRole')}</option>
                    </select>
                  </label>
                </div>
                <label>
                  <input
                    type="checkbox"
                    required
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                  />{' '}
                  {t('consent')}
                </label>
                <div style={{ marginTop: 16 }}>
                  <Button type="submit" variant="primary" disabled={action || !consent}>
                    {t('beginParticipant')}
                  </Button>
                </div>
              </form>
            )}
          </section>
        )}
        <Tabs.Content value="expert">
          <div className="evaluation-tools">
            <p className="help-note">{t('blindRule')}</p>
            {exportButtons('reviews')}
          </div>
          <div className="form-row">
            <label className="field">
              <span>{t('studyDesign')}</span>
              <select
                value={design}
                onChange={(e) => {
                  setDesign(e.target.value as typeof design);
                  setReport(undefined);
                }}
              >
                <option value="paired">{t('paired')}</option>
                <option value="independent">{t('independent')}</option>
              </select>
            </label>
            <label className="field">
              <span>{t('case')}</span>
              <select disabled={action} value={caseId} onChange={(e) => setCaseId(e.target.value)}>
                <option value="">{t('chooseCase')}</option>
                {data.cases.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title} · {t(c.design)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
            {scope === 'dev' && (
              <Button
                disabled={action}
                onClick={() =>
                  void perform(async () => {
                    const c = await research.seedDev(design);
                    setCaseId(c.id);
                    await page.refresh();
                  })
                }
              >
                {t('seedCase')}
              </Button>
            )}
            <Button onClick={() => setSetup(!setup)}>{t('setupCase')}</Button>
          </div>
          {setup && (
            <form
              className="intake-form"
              onSubmit={(e) => {
                e.preventDefault();
                void perform(async () => {
                  const c = await research.createCase(scope, {
                    projectId,
                    title: caseTitle,
                    baselineMarkdown: baseline,
                    referenceLanguage,
                    provenanceNote: provenance,
                    design,
                  });
                  setCaseId(c.id);
                  setSetup(false);
                  await page.refresh();
                });
              }}
            >
              <h2>{t('setupCase')}</h2>
              <p className="help-note">{t('snapshotNote')}</p>
              <label className="field">
                <span>{t('project')}</span>
                <select required value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                  <option value="">{t('chooseProject')}</option>
                  {data.overview.eligibleProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>{t('caseTitle')}</span>
                <input
                  required
                  maxLength={150}
                  value={caseTitle}
                  onChange={(e) => setCaseTitle(e.target.value)}
                />
              </label>
              <label className="field">
                <span>{t('baseline')}</span>
                <textarea
                  required
                  rows={8}
                  maxLength={100000}
                  value={baseline}
                  onChange={(e) => setBaseline(e.target.value)}
                />
              </label>
              <label className="field">
                <span>{t('referenceLanguage')}</span>
                <select
                  value={referenceLanguage}
                  onChange={(e) => setReferenceLanguage(e.target.value as 'id' | 'en')}
                >
                  <option value="id">Bahasa Indonesia</option>
                  <option value="en">English</option>
                </select>
              </label>
              <label className="field">
                <span>{t('provenance')}</span>
                <textarea
                  required
                  minLength={8}
                  maxLength={2000}
                  value={provenance}
                  onChange={(e) => setProvenance(e.target.value)}
                />
              </label>
              <Button type="submit" variant="primary" disabled={action}>
                {t('saveCase')}
              </Button>
            </form>
          )}
          {!data.cases.length && <p>{t('noCases')}</p>}
          {person?.role === 'expert' && caseId && (
            <>
              {blind.error ? (
                <ErrorState error={blind.error} retry={blind.refresh} />
              ) : blind.busy ? (
                <Loading />
              ) : (
                <div className="expert-layout">
                  <div className="blind-preview">
                    <div style={{ display: 'flex', gap: 10 }}>
                      {blind.data?.map((d) => (
                        <Button
                          key={d.label}
                          variant={label === d.label ? 'primary' : 'secondary'}
                          onClick={() => setLabel(d.label)}
                        >
                          {root('blindDocument', { label: d.label })}
                          {d.submitted ? ' ✓' : ''}
                        </Button>
                      ))}
                    </div>
                    <h3>{root('blindDocument', { label })}</h3>
                    <Markdown text={document?.markdown ?? ''} />
                  </div>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!document) return;
                      void perform(async () => {
                        await research.saveReview(scope, {
                          assignmentId: document.id,
                          ...current,
                          comments: comment,
                        });
                        await research.blind(scope, caseId);
                        await blind.refresh();
                        await page.refresh();
                        setNotice(t('saved'));
                      });
                    }}
                  >
                    <p>{t('caseDesign', { design: t(currentCase?.design ?? 'paired') })}</p>
                    {dimensions.map((dimension, index) => (
                      <div className="expert-dimension" key={dimension}>
                        <header>
                          <h3>{root(dimension)}</h3>
                          <Scale
                            name={`${label}-${dimension}`}
                            value={current.ratings[index]!}
                            onChange={(n) =>
                              setReviews((old) => ({
                                ...old,
                                [label]: {
                                  ...old[label],
                                  ratings: old[label].ratings.map((v, i) => (i === index ? n : v)),
                                },
                              }))
                            }
                          />
                        </header>
                        <textarea
                          required
                          maxLength={4000}
                          aria-label={`${root('justification')} ${root(dimension)}`}
                          value={current.justifications[index]}
                          onChange={(e) =>
                            setReviews((old) => ({
                              ...old,
                              [label]: {
                                ...old[label],
                                justifications: old[label].justifications.map((v, i) =>
                                  i === index ? e.target.value : v,
                                ),
                              },
                            }))
                          }
                        />
                      </div>
                    ))}
                    <label className="field">
                      <span>{root('comments')}</span>
                      <textarea
                        maxLength={8000}
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                      />
                    </label>
                    <Button
                      type="submit"
                      variant="primary"
                      disabled={action || document?.submitted || !document}
                    >
                      {document?.submitted ? root('reviewSaved') : root('submitReview')}
                    </Button>
                    {complete && (
                      <div style={{ marginTop: 20 }}>
                        <Button
                          disabled={action}
                          onClick={() =>
                            void perform(async () =>
                              setMapping(await research.mapping(scope, caseId)),
                            )
                          }
                        >
                          {t('revealMapping')}
                        </Button>
                        {Object.entries(mapping).map(([key, value]) => (
                          <p className="help-note" key={key}>
                            {key}: {t(value)}
                          </p>
                        ))}
                      </div>
                    )}
                  </form>
                </div>
              )}
            </>
          )}
          <section style={{ marginTop: 32 }}>
            <h2>{t('statistics')}</h2>
            <p className="help-note">{t('analysisUnit')}</p>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>{t('descriptive')}</th>
                    {dimensions.map((d) => (
                      <th key={d}>{root(d)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(['system', 'human'] as const).map((source) => (
                    <tr key={source}>
                      <td>{t(source)}</td>
                      {dimensions.map((d) => {
                        const row = data.overview.dimensions.find(
                          (r) => r.source === source && r.dimension === d,
                        )?.statistics;
                        return (
                          <td key={d}>
                            n={row?.n ?? 0} · {num(row?.mean)} / {num(row?.median)} / {num(row?.sd)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Button
                disabled={action}
                onClick={() =>
                  void perform(async () => {
                    setReport(await research.computeStatistics(scope, { design, seed: 20261110 }));
                    await page.refresh();
                  })
                }
              >
                {t('computeStatistics')}
              </Button>
              <label className="text-link">
                {t('importReport')}
                <input
                  type="file"
                  accept=".json"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f)
                      void perform(async () => {
                        if (f.size > 2 * 1024 * 1024)
                          throw new PortError('too_large', false, 'backendErrors.too_large');
                        await research.importReport(scope, JSON.parse(await f.text()));
                        await page.refresh();
                        setNotice(t('verifiedImport'));
                      });
                  }}
                />
              </label>
              {exportButtons('statistics')}
            </div>
            {(report
              ? [report]
              : data.statistics.filter((r) => r.design === design).slice(0, 1)
            ).map((r, index) => (
              <div key={index}>
                <p>
                  {t('reportDesign', { design: t(r.design) })} · {t('adjustment')}
                </p>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>{t('dimension')}</th>
                        <th>{t('sampleN')}</th>
                        <th>W/U</th>
                        <th>p (Holm)</th>
                        <th>{t('effect')}</th>
                        <th>95% CI</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.results.map((row) => (
                        <tr key={row.dimension}>
                          <td>{root(row.dimension)}</td>
                          <td>
                            {row.n_system} / {row.n_human}
                          </td>
                          <td>{row.statistic.toFixed(2)}</td>
                          <td>{row.p_adjusted.toPrecision(3)}</td>
                          <td>{row.effect_size.toFixed(3)}</td>
                          <td>
                            {row.effect_ci
                              ? `${row.effect_ci.low.toFixed(3)} — ${row.effect_ci.high.toFixed(3)}`
                              : t('ciUnavailable')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="help-note">{t('effectMeaning')}</p>
              </div>
            ))}
          </section>
        </Tabs.Content>
        <Tabs.Content value="sus">
          <div className="evaluation-tools">
            <p>{root('susDescription')}</p>
            {exportButtons('sus')}
          </div>
          <p className="help-note">
            {t('susSummary', {
              count: data.overview.counts.sus,
              mean: num(data.overview.sus.mean),
            })}
          </p>
          {(susScore ?? person?.sus?.score) !== undefined ? (
            <div className="result-panel">
              <h2>{root('susResult')}</h2>
              <strong>{(susScore ?? person?.sus?.score)!.toFixed(1)} / 100</strong>
              <p>{t('serverScored')}</p>
            </div>
          ) : (
            <form
              className="questionnaire"
              onSubmit={(e) => {
                e.preventDefault();
                void perform(async () => {
                  const result = await research.saveSus(scope, {
                    answers,
                    comment: susComment,
                    ...(projectId ? { projectId } : {}),
                  });
                  setSusScore(result.score);
                  await page.refresh();
                });
              }}
            >
              <label className="field">
                <span>{t('project')}</span>
                <select
                  value={projectId}
                  required={scope === 'research'}
                  onChange={(e) => setProjectId(e.target.value)}
                >
                  <option value="">
                    {t(scope === 'dev' ? 'generalSession' : 'chooseProject')}
                  </option>
                  {data.overview.eligibleProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </label>
              <div className="questionnaire-intro">
                <h2>System Usability Scale</h2>
                <p className="help-note">{root('susScale')}</p>
              </div>
              {items[locale === 'id' ? 'id' : 'en'].map((question, index) => (
                <div className="question-row" key={index}>
                  <label>
                    <span className="question-number">{index + 1}.</span>
                    {question}
                  </label>
                  <Scale
                    name={`SUS ${index + 1}`}
                    value={answers[index]!}
                    onChange={(n) => setAnswers((old) => old.map((v, i) => (i === index ? n : v)))}
                  />
                </div>
              ))}
              <label className="field">
                <span>{root('comments')}</span>
                <textarea
                  rows={3}
                  maxLength={8000}
                  value={susComment}
                  onChange={(e) => setSusComment(e.target.value)}
                />
              </label>
              <Button
                type="submit"
                variant="primary"
                disabled={
                  action ||
                  !person ||
                  answers.some((v) => !v) ||
                  (scope === 'research' && !projectId)
                }
              >
                {root('submitSus')}
              </Button>
            </form>
          )}
        </Tabs.Content>
        <Tabs.Content value="rouge">
          <div className="evaluation-tools">
            <p className="help-note">{t('rougeGuard')}</p>
            {exportButtons('rouge')}
          </div>
          <label className="field">
            <span>{t('case')}</span>
            <select value={caseId} onChange={(e) => setCaseId(e.target.value)}>
              <option value="">{t('chooseCase')}</option>
              {data.cases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </label>
          {currentCase && (
            <p>
              {t('languages', {
                prediction: currentCase.language,
                reference: currentCase.referenceLanguage,
              })}
            </p>
          )}
          {scope === 'dev' &&
            currentCase &&
            currentCase.language !== currentCase.referenceLanguage && (
              <>
                <label>
                  <input
                    type="checkbox"
                    checked={override}
                    onChange={(e) => setOverride(e.target.checked)}
                  />
                  {t('allowMismatch')}
                </label>
                <label className="field">
                  <span>{t('overrideReason')}</span>
                  <textarea
                    minLength={12}
                    maxLength={2000}
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                  />
                </label>
              </>
            )}
          {currentCase?.language === 'en' && currentCase.referenceLanguage === 'en' && (
            <label>
              <input
                type="checkbox"
                checked={stemmer}
                onChange={(e) => setStemmer(e.target.checked)}
              />
              {t('stemmer')}
            </label>
          )}
          <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
            <Button
              variant="primary"
              disabled={action || !caseId}
              onClick={() =>
                void perform(async () => {
                  await research.scoreRouge(scope, {
                    caseIds: [caseId],
                    allowLanguageMismatch: override,
                    overrideReason,
                    useStemmer:
                      stemmer &&
                      currentCase?.language === 'en' &&
                      currentCase.referenceLanguage === 'en',
                  });
                  await page.refresh();
                })
              }
            >
              {t('computeRouge')}
            </Button>
            <label className="text-link">
              {t('importReport')}
              <input
                type="file"
                accept=".json"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f)
                    void perform(async () => {
                      if (f.size > 2 * 1024 * 1024)
                        throw new PortError('too_large', false, 'backendErrors.too_large');
                      await research.importReport(scope, JSON.parse(await f.text()));
                      await page.refresh();
                      setNotice(t('verifiedImport'));
                    });
                }}
              />
            </label>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>{root('scenario')}</th>
                  {['ROUGE-1', 'ROUGE-2', 'ROUGE-L'].map((metric) => (
                    <th key={metric}>
                      {metric}
                      <br />P / R / F1
                    </th>
                  ))}
                  <th>{t('comparison')}</th>
                </tr>
              </thead>
              <tbody>
                {data.rouge.length === 0 && (
                  <tr>
                    <td colSpan={5}>{t('emptyScope')}</td>
                  </tr>
                )}
                {data.rouge.map((row, index) => (
                  <tr key={index}>
                    <td>{row.scenario}</td>
                    {(['rouge1', 'rouge2', 'rougeL'] as const).map((key) => (
                      <td key={key}>
                        {row[key].precision.toFixed(3)} / {row[key].recall.toFixed(3)} /{' '}
                        {row[key].f1.toFixed(3)}
                      </td>
                    ))}
                    <td>{t(row.valid_comparison ? 'matchedLanguage' : 'invalidLanguage')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Tabs.Content>
      </Tabs.Root>
      {action && (
        <p role="status" className="help-note">
          {root('loading')}
        </p>
      )}
      {notice && (
        <p role="status" className="help-note">
          {notice}
        </p>
      )}
      {formError && (
        <p role="alert" className="inline-error">
          {formError}
        </p>
      )}
    </main>
  );
}
