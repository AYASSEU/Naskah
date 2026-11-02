# Phase 1 implementation report

Run on Windows: `pnpm install`, `pnpm dev`, then http://127.0.0.1:3000.
Production: `pnpm build`, `pnpm start`.

## Delivered

| Brief phases | Result                                                                                                                                               |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0–1          | Workspace scaffold, conventions, design plan, shared Zod contracts, typed ports, mode registry                                                       |
| 2            | Bespoke tokens, locally hosted fonts, light/dark shell, Indonesian/English dictionaries, Radix primitives                                            |
| 3            | IndexedDB repositories, three fixtures, incremental generation, failure/retry, retrieval and quality fixtures                                        |
| 4            | Searchable/filterable ledger, project actions, intake, browser PDF/TXT extraction and cleaning, raw-text previews                                    |
| 5–6          | Chapter outline, manuscript and margin identifiers, inspector, Markdown autosave, section locks, revision proposals, word diff, history and restore  |
| 7            | Finalization, genuine IEEE-style DOCX, print-to-PDF route, export summary                                                                            |
| 8            | Generation summary, blind expert form with rationales and descriptive statistics, SUS, ROUGE JSON/CSV import, statistical JSON import, research mode |
| 9            | Inert SQL/Compose scaffolds, webhook 501 handlers, HTTP stubs, prompts, integration roadmap and traceability                                         |
| 10           | Automated gates, browser flows, responsive screenshots, contrast audit and visual corrections                                                        |

## Verification

AI Settings follow-up (23 October 2026): `/settings` now has provider, model,
HTTPS endpoint and a masked API key input with show/hide, save, remove and a
simulated connection test. Public configuration persists in IndexedDB; keys
stay in tab memory and disappear on refresh. Shared schemas, a dedicated service
port and explicit 501 routes prepare the later backend integration. Six added
unit tests cover credential isolation, validation, reset, failed writes and the
API placeholders. Browser coverage includes both locales, light/dark themes,
desktop/mobile, refresh, navigation and destination changes. Four screenshots
are named `*-ai-settings-{desktop,mobile}.png`.

- TypeScript and ESLint pass.
- 29 Vitest tests pass, including AI credential isolation and configuration,
  malformed-storage recovery, PDF/text cleaning,
  shared contracts, requirement IDs, structure checking, SUS polarity, revision
  isolation, locked/stale proposals, ordered generation, failure recovery and
  actual DOCX ZIP contents/margins.
- 16 Playwright flows pass in Microsoft Edge, eight in each theme. Coverage:
  text intake, PDF plus notes, generation, direct editing, revision accept/reject,
  finalization, actual Word download, recovery, SUS and blind expert submission,
  English switching, simultaneous revision proposals, mobile SUS steps and responsive screens.
- Production build, semantic design audit, and all 26 declared WCAG AA text
  pairings pass.
- 48 screen/theme/width screenshots cover ledger, intake, ready workspace,
  generation, revision diff and export, at 1440/1024/768/390. Extra screenshots
  show a workspace detail, mobile SUS, the design system and the configured live stub error.
- Additional 360px intake overflow check passes. Developer keyboard controls,
  injected chapter failure/resume and revision timeout with preserved input also pass.
- Live mode without server config shows a configuration screen. Validly shaped
  fake config shows a localized NotImplementedError, with no backend network
  requests. Valid parse/compile stub requests return 501; invalid callback
  payloads return 400.

## Simulated behavior and deviations

- Generation, retrieval, guardrails and AI revisions are deterministic fixtures,
  not model inference. Normal generation takes about 28 seconds. Unrecognized
  revision instructions become a visibly marked clause for human verification.
- A/B mapping is fixed for demonstration. The human baseline, reference excerpts,
  initial 12 logs and ROUGE sample are synthetic. Research deployment requires
  real source documents, randomized blind mapping and validated instruments.
- The first launch seeds three demonstration projects so the UI can be inspected
  immediately. Settings → reset exposes the specified empty state; examples can
  be reloaded from the empty ledger. New user input is persisted locally.
- Fonts use `next/font/local` with Fontsource packages, rather than build-time
  Google downloads. The families remain exactly those requested. TypeScript is
  pinned to 5.9 because the available ESLint parser rejects TypeScript 7.
- The measured initial modern-browser ledger script payload is about **244 KB
  gzipped**, above the brief's 200 KB target. Heavy parser/editor/compiler/diff
  tools are lazy-loaded. Further splitting of shared schema and overlay code is
  still needed before treating the performance budget as satisfied.
- Quality gates were consolidated at integration milestones rather than running
  every full gate after each scaffold subphase. No per-phase Git commits were
  made: the supplied directory was not a Git repository.
- Motion is restrained CSS rather than the detailed staggered chapter animation
  sequence in the brief. Native browser section containment keeps long documents
  responsive. The anti-slop checker is heuristic, not a formal layout verifier.
- The export summary does not claim comparison against a measured human drafting
  time; that comparison needs the thesis baseline and an actual study.

## Visual critique

The standard-specific chapter outline, requirement margin, quality rewrites and
versioned manuscript make the workspace recognizable with the logo covered.
Gold marks the primary action, selected section, focus and proposed text.
Dark mode uses warm ink on dark manuscript stock; light mode uses a stone desk
and white paper. The export sheet deliberately stays light in both themes.

The last pass removed a repeated standard note from the ledger, increased small
interface labels, fixed dark-theme hydration, and moved requirement IDs inside
the section's paint containment so they remain visible in the margin. Review
`dark-workspace-detail-1440.png`, the paired ledger screenshots, and mobile
export/diff screenshots for these decisions.

## Backend next steps

1. Review and start n8n with authenticated webhooks.
2. Apply reviewed Supabase/pgvector schema with RLS and owner-scoped access.
3. Ingest reference datasets with document-level 80:20 split and section chunks.
4. Implement Workflow 1 and translate backend progress into GenerationEvent.
5. Implement isolated Workflow 2 with concurrency checks and proposal acceptance.

Full acceptance steps: `docs/backend-roadmap.md`. Functional mapping:
`docs/traceability.md`. Screenshots: `docs/screenshots/`.
