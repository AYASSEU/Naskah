# Claude Code Prompt: Naskah, Phase 1 (Functioning UI/UX First, Backend-Ready)

Paste everything below the line into Claude Code at the root of an empty project folder. It is written as direct instructions to you, the coding agent.

---

# ROLE

You are a senior product engineer and design lead. You are building the front end of a thesis (skripsi) project: a web application that automates drafting of Software Requirements Specification (SRS) documents following IEEE 830-1998, using Retrieval-Augmented Generation (RAG) and an LLM, orchestrated by n8n.

The thesis is "Implementasi Retrieval-Augmented Generation dengan Large Language Model untuk Otomatisasi Pembuatan Software Requirements Specification Berstandar IEEE" (Program Studi Rekayasa Perangkat Lunak, UPI Kampus Cibiru). The research follows Design Science Research Methodology (DSRM) and evaluates three things: RQ1 automation capability and structure completeness, RQ2 quality of the SRS (unambiguous, complete, correct, verifiable) against a human baseline, RQ3 usability via the System Usability Scale (SUS). The application is both the research artifact and the instrument that collects evaluation data, so the UI must be solid enough to put in front of 10 expert evaluators.

# THE ONE RULE THAT SHAPES EVERYTHING

**Phase 1 builds a fully functioning UI/UX on top of a mock service layer. No real backend is built yet.** No n8n workflow, no Supabase, no DeepSeek call, no vector search. But every one of those things must have a clearly defined slot waiting for it, so that Phase 2 (backend) is a matter of writing adapters and flipping an environment variable, not rewriting the front end.

Concretely:

1. Every user flow works end to end in the browser against realistic simulated data, including loading, progress, partial failure, empty, and error states.
2. The UI never talks to a mock directly. It talks to **ports** (TypeScript interfaces). Mocks are one adapter; HTTP/n8n/Supabase adapters are stubs that will be the other.
3. All payload shapes that cross the front end / n8n boundary are defined once as **Zod schemas in a shared package**, copied exactly from the SRS spec below. The mocks must produce and consume the same shapes the real backend will.
4. The repository ships the scaffolding for the future backend (folders, READMEs, SQL migration, docker-compose, workflow documentation, env template, 501 route stubs) as **documented, non-functional placeholders**. Do not implement them. Do not run them.

If you ever feel tempted to hardcode data inside a component, stop and put it behind a port.

# WORKING AGREEMENTS

- Work in the phases defined in section 13. At the end of each phase: run typecheck, lint, tests, and build; fix everything; commit with a clear message; then write a short phase report (what was built, what was deliberately deferred, any deviation from this prompt and why). Then continue to the next phase without waiting, unless something here is genuinely ambiguous and blocking.
- Start by creating `CLAUDE.md` at the repo root summarizing the conventions in this prompt (architecture rules, design tokens, anti-slop rules, commands). Keep it under 150 lines. Update it as decisions are made.
- Be honest in reports. If something is faked, say it is faked. If a library did not work and you substituted another, say so.
- Prefer boring, durable choices in the code (strict TypeScript, small modules, pure functions for logic) and spend your creativity budget on the design and on the document-editing experience.
- Windows is the primary development machine (Dell Precision 5510 with Docker Desktop and WSL2). Do not write bash-only scripts. Use Node scripts (`.mjs`) for tooling so everything runs on Windows, macOS, and Linux.
- Search the web if you need current information about a library's API (Next.js App Router, Tailwind, next-intl, Motion, `@uiw/react-md-editor`, the `docx` package). Do not guess version-specific APIs from memory.

---

# 1. PRODUCT CONTEXT

## 1.1 What the system does (target state)

A user describes a system to be built (typed notes, or an uploaded PDF/TXT such as an interview transcript, meeting minutes, or a Terms of Reference). The system retrieves similar reference requirements from a knowledge base (PURE, PROMISE_exp, Kaggle fault-prone SRS dataset), builds one prompt per IEEE 830 chapter, calls DeepSeek-V4-Flash through n8n, runs a quality guardrail that detects and rewrites ambiguous phrasing into measurable statements, aggregates the chapters into Markdown, and hands the draft to a human. The human edits it directly or asks the AI to revise one chapter at a time, reviews changes in a diff, approves, and downloads a formal `.docx` or `.pdf`.

## 1.2 What Phase 1 delivers

The complete user-facing application running on a simulated backend, plus the evaluation instruments (expert blind review form, SUS form, structure and success-rate dashboards), plus the backend-readiness scaffolding.

## 1.3 Users

- **Primary:** requirements engineers, system analysts, software engineering students. Comfortable with documents and structured text. Not necessarily comfortable with prompts.
- **Evaluation participants:** up to 10 RE experts doing a blind review and a SUS questionnaire. They will use the app once or twice, so first-use clarity matters more than power-user shortcuts, but keyboard support still matters for the editor.

## 1.4 Language

The interface language is **Indonesian by default**, with English as a second locale. All user-facing strings live in message dictionaries from day one (use `next-intl`). Generated SRS content in fixtures is Indonesian. The SRS template headings use the English IEEE 830 terms alongside the Indonesian ones where the standard names them (for example "3. Specific Requirements (Kebutuhan Spesifik)").

## 1.5 Working name

Use **"Naskah"** (Indonesian for manuscript) as a placeholder app name, defined in exactly one constant (`src/shared/config/brand.ts`) so it can be renamed in one edit. Tagline in the same file, plain and descriptive, no marketing language: "Penyusun draf SRS berstandar IEEE 830".

---

# 2. SOURCE SPECIFICATION (AUTHORITATIVE, DO NOT DEVIATE)

These come from the SRS/PRD document for the project. Treat them as requirements.

## 2.1 Functional requirements to implement in the UI

**Input (multi-format)**
- `FR-IN-01` User types or pastes a system description into a textarea (rough ideas, feature summaries, early specs).
- `FR-IN-02` User uploads a `.pdf` or `.txt` file (interview transcripts, meeting minutes, Terms of Reference).
- `FR-IN-03` A local parser module extracts raw text from the PDF, strips junk (stray line breaks, repeating headers/footers, non-UTF-8 characters), and merges everything into one clean context corpus before it is sent to the RAG flow.

**Human-in-the-loop, dual mode (the key feature)**
- `FR-HITL-01` Direct manual editing in an interactive Markdown editor. Fix typos, delete clauses, add requirements, with no LLM involved.
- `FR-HITL-02` AI-assisted revision: the user picks a chapter or subsection and types an instruction, for example "Ubah bagian kebutuhan keamanan agar mewajibkan 2-Factor Authentication dan enkripsi AES-256" or "Perjelas use case pembayaran agar mendukung QRIS".
- `FR-HITL-03` Targeted partial update: a revision request regenerates only the selected section in isolation, without touching sections already approved or edited.
- `FR-HITL-04` Version diff viewer: visual before/after comparison of an AI revision, with Accept and Reject before anything is saved.

**Export**
- `FR-EXP-01` On approval, compile the Markdown into an IEEE 830-1998 formal document: cover page, automatic table of contents, hierarchical chapter numbering, formal table layout.
- `FR-EXP-02` Download as `.docx` and `.pdf`.

## 2.2 Target stack (from the SRS)

| Layer | Technology |
|---|---|
| Frontend | React / Next.js (App Router), Tailwind CSS |
| Editor | `@uiw/react-md-editor` (Monaco is an acceptable alternative) |
| File parser | Node `pdf-parse` or Python `pypdf` / `pdfplumber` (Phase 2 service; Phase 1 uses a browser-side implementation behind the same port) |
| Orchestrator | n8n, self-hosted via Docker Compose (Phase 2) |
| LLM | DeepSeek-V4-Flash API, model `deepseek-chat` (Phase 2) |
| Vector DB | Supabase Postgres with `pgvector`, or Qdrant (Phase 2) |
| Relational DB | PostgreSQL on Supabase (Phase 2) |
| Document compiler | Pandoc / python-docx / WeasyPrint (Phase 2; Phase 1 does a client-side compile behind the same port) |

## 2.3 n8n contracts (define as Zod schemas now, in the shared package)

**Workflow 1, generate draft.** `POST /webhook/generate-srs`

```json
{
  "session_id": "uuid-string",
  "project_title": "Sistem Manajemen Rumah Sakit",
  "domain": "Healthcare",
  "raw_text": "Combined textarea input and extracted PDF text..."
}
```

Backend stages, in order: webhook trigger, top-K retrieval (K = 5 to 8 chunks), loop over four IEEE 830 parts, per-chapter prompt construction, LLM call (temperature 0.2, JSON output), quality guardrail/reflection (checks unambiguous, complete, correct, verifiable; rewrites vague phrases like "sistem harus cepat" into testable ones like "waktu respons tidak melebihi 2 detik pada beban 500 pengguna konkuren"), section aggregator, callback `POST /api/webhooks/srs-ready` with the full Markdown.

The four parts:
1. Introduction (Purpose, Scope, Glossary, References)
2. Overall Description (Product Perspective, User Classes, Operating Environment, Constraints, Assumptions)
3. Specific Requirements (Functional Requirements with unique IDs such as `REQ-F-01`, External Interface Requirements, Performance Requirements, Security, Software Attributes)
4. Supporting Artifacts (Use Case Narratives, Requirements Traceability Matrix)

**Workflow 2, AI revision.** `POST /webhook/revise-srs`

```json
{
  "session_id": "uuid-string",
  "target_section": "3.2 Functional Requirements",
  "current_section_text": "Current chapter text...",
  "user_instructions": "What the user wants changed..."
}
```

Backend stages: query refinement and expansion (LLM forms a new retrieval query), targeted regeneration of only that section, callback returning the updated section text.

**Structured chapter output** (from the prompt template in the SRS): the LLM returns JSON for chapter 3 shaped as `section_title`, `external_interfaces`, `functional_requirements[]` (`id`, `title`, `description`, `priority` = High/Medium/Low, plus actor, input, process, output), `performance_requirements`, `security_requirements`. Model this as `ChapterOutput` in the contracts package.

## 2.4 Data model hints from the SRS

`srs_generation_logs`: `session_id`, `project_title`, `domain`, `status`, `execution_time_seconds`, `structure_completeness_pct`, `created_at`. The mock engine must record one of these per generation so the evaluation dashboard has real data to show.

---

# 3. SCOPE OF PHASE 1

## 3.1 Build

- App shell, routing, theming (light and dark), i18n (id, en).
- Project ledger (home), project creation with multi-format input, live generation progress, workspace with manuscript editor, per-section dual-mode HITL, AI revision modal, diff viewer, approval, export page with real client-side `.docx` and print-ready `.pdf` path.
- Evaluation area: structure and success-rate dashboard, expert blind-review form, SUS form and scorer, ROUGE results import/display.
- Research mode toggle (shows the SUS prompt after export, enables blind labels).
- A developer tools drawer for the simulation (speed, failure injection).
- Backend-readiness scaffolding and documentation (section 5.6 and 14).

## 3.2 Do not build

- Any real HTTP calls to n8n, DeepSeek, Supabase, or Qdrant.
- Authentication beyond a single local user (but include an `AuthPort` so it can be added).
- Docker execution, database migrations running, Python services. Files may exist; nothing runs.
- A marketing landing page. The first screen a person sees is the product.

---

# 4. TECH STACK FOR PHASE 1

- **Next.js** (current stable, App Router) with **TypeScript in strict mode** (`noUncheckedIndexedAccess` on).
- **Tailwind CSS** configured entirely from design tokens (CSS variables), no default Tailwind palette used anywhere in components.
- **Radix UI primitives** (Dialog, Popover, Tabs, Tooltip, DropdownMenu, Switch, ScrollArea, AlertDialog) styled by us. Do **not** scaffold shadcn/ui and ship it unmodified; its default look is a major source of sameness. If you copy any shadcn component, restyle it fully to this prompt's tokens.
- **next-themes** for light/dark with no flash on load.
- **next-intl** for i18n.
- **Zustand** for client state, with a persistence adapter (see 5.4). **Zod** for contracts. **TanStack Query** is optional; use it if it simplifies the live-mode path, otherwise keep to ports plus Zustand.
- **Motion** (the `motion` package, formerly Framer Motion) for the few animations specified in 6.8.
- **`@uiw/react-md-editor`** wrapped in our own `ManuscriptEditor` component so it can be swapped (CodeMirror 6 is the fallback). Restyle it completely to the tokens.
- **`diff`** package for word-level diffs, with our own renderer.
- **`docx`** package for client-side `.docx` generation in the mock compiler. **`pdfjs-dist`** for browser-side PDF text extraction.
- **Vitest** + Testing Library for logic and component tests; **Playwright** for a small end-to-end smoke suite and for screenshots in both themes.
- **pnpm** workspaces. ESLint (flat config), Prettier, `tsc --noEmit` as scripts.
- Fonts via `next/font` (self-hosted, no runtime request to Google).

---

# 5. ARCHITECTURE (BUILT FOR THE BACKEND THAT IS COMING)

## 5.1 Repository layout

```
naskah/
  CLAUDE.md
  README.md
  package.json                 # pnpm workspace root
  pnpm-workspace.yaml
  apps/
    web/                       # the Next.js app (Phase 1 focus)
      src/
        app/                   # routes only, thin; no business logic
          (app)/
            page.tsx                       # project ledger
            new-project/page.tsx
            workspace/[id]/page.tsx
            export/[id]/page.tsx
            evaluation/page.tsx
            settings/page.tsx
          api/                             # 501 stubs only (see 5.6)
            parse-pdf/route.ts
            compile-document/route.ts
            webhooks/srs-ready/route.ts
        features/              # vertical slices; each owns its UI + hooks + local state
          project-ledger/
          intake/                          # FR-IN-*
          generation-progress/
          workspace/                       # manuscript, contents rail, inspector
          revision/                        # FR-HITL-02/03/04
          export/                          # FR-EXP-*
          evaluation/                      # RQ1/RQ2/RQ3 instruments
          settings/
          devtools/                        # simulation controls
        entities/              # domain types + pure logic, no React
          project/  document/  section/  requirement/  revision/
          guardrail/  evaluation/  template/
        services/
          ports/               # interfaces (the only thing features import)
          mock/                # Phase 1 adapters
          http/                # Phase 2 adapters (stubs throwing NotImplementedError)
          registry.ts          # picks adapters by NEXT_PUBLIC_DATA_MODE
        shared/
          ui/                  # design-system primitives
          lib/                 # pure helpers
          config/              # brand, flags, env parsing
          i18n/                # messages/id.json, messages/en.json
          styles/              # tokens.css, typography.css, print.css
    # future: apps/worker, apps/compiler if they become TypeScript services
  packages/
    contracts/                 # Zod schemas + inferred types, shared by web and future services
  infra/
    docker-compose.yml         # n8n per the SRS. NOT started in Phase 1.
    .env.example
  supabase/
    migrations/0001_init.sql   # pgvector + tables from the SRS. NOT applied in Phase 1.
  n8n/
    README.md                  # node-by-node description of both workflows
    workflows/                 # empty, .gitkeep
    prompts/                   # chapter prompt templates as data files (see 5.7)
  ingestion/
    README.md                  # offline dataset pipeline plan (80:20 split, chunking, embeddings)
  evaluation-scripts/
    README.md                  # rouge-score, regex structure checker, scipy tests, SUS calculator
  compiler-service/
    README.md                  # Pandoc + LibreOffice headless plan
  docs/
    architecture.md  contracts.md  backend-roadmap.md  design-system.md  decisions/
```

Import rules, enforced with ESLint `no-restricted-imports` or `eslint-plugin-boundaries`:
- `app/*` imports from `features/*` only.
- `features/*` import from `entities`, `services/ports`, `shared`, and `packages/contracts`. Never from `services/mock` or `services/http`. Never from another feature's internals (use its `index.ts`).
- `entities/*` import nothing from React, Next, or services.
- Only `services/registry.ts` knows which adapter set is active.

## 5.2 Ports (define all of these in `services/ports`)

```ts
ProjectRepository      list, get, create, update, delete
DocumentRepository     getDocument, saveSection, saveSections, listVersions, restoreVersion
GenerationService      start(input): GenerationHandle
                       // handle exposes: subscribe(listener): unsubscribe, cancel(), getSnapshot()
RevisionService        requestRevision(input): Promise<RevisionProposal>
                       // proposal holds before/after text for exactly one section
ParserService          extractText(file: File): Promise<ParsedDocument>   // FR-IN-03
CompilerService        compile(documentId, format: "docx" | "pdf"): Promise<CompiledArtifact>
EvaluationRepository   logGeneration, listGenerationLogs, saveExpertReview,
                       listExpertReviews, saveSusResponse, listSusResponses,
                       importRougeResults, listRougeResults
AuthPort               getCurrentUser (single local user in Phase 1)
TelemetryPort          track(event)  (no-op in Phase 1)
```

Rules: ports are async and return plain serializable data. Errors are typed (`PortError` with `code`, `retryable`, `userMessage` key for i18n). Nothing in a port signature is mock-specific.

## 5.3 Generation as an event stream

Real generation will be a long-running n8n execution that calls back later. Model it as events from the start so the UI never depends on a single request/response:

```ts
type GenerationEvent =
  | { type: "stage"; stage: "retrieving_context" | "drafting" | "guardrail" | "assembling" | "ready"; at: string }
  | { type: "section_started"; sectionId: string }
  | { type: "section_drafted"; sectionId: string; markdown: string }
  | { type: "guardrail_report"; sectionId: string; report: GuardrailReport }
  | { type: "retrieval_context"; chunks: RetrievedChunk[] }       // shown in the inspector
  | { type: "failed"; stage: string; error: PortError }
  | { type: "completed"; document: SrsDocument; log: GenerationLog }
```

Mock adapter emits these on timers. Phase 2 adapter will translate SSE or polling plus the `srs-ready` callback into the same events. The four-step progress tracker in the UI maps from stages: (1) Mengambil konteks semantik, (2) Menyusun Bab 1 sampai 4 IEEE 830, (3) Validasi quality guardrail, (4) Draf siap ditinjau.

## 5.4 Domain model (in `entities` and `packages/contracts`)

- `Project`: id (uuid), title, domain, version label, status (`draft_input | generating | in_review | finalized | failed`), createdAt, updatedAt, sessionId.
- `SrsTemplate`: **data-driven chapter definition.** IEEE 830-1998 is one template object (four parts, subsections, per-section prompt file reference, required headings for the structure checker). The proposal itself notes IEEE 830 is superseded by ISO/IEC/IEEE 29148, so a second template must be addable as data without touching components. Build the UI so it renders whatever sections the active template defines.
- `SrsDocument`: projectId, templateId, sections tree, metadata.
- `Section`: id, number ("3.2"), title, markdown, status (`pending | generating | drafted | edited | revised | locked`), source (`ai | human | ai_revised`), requirements[] (parsed from markdown by pure functions), guardrail summary, updatedAt.
- `Requirement`: id (`REQ-F-01`), title, description, actor, input, process, output, priority.
- `RevisionProposal`: id, sectionId, instruction, before, after, retrievalQuery (the refined query), status (`pending | accepted | rejected`).
- `GuardrailReport`: per section, four dimension verdicts (unambiguous, complete, correct, verifiable), and a list of `Rewrite` items (`original`, `rewritten`, `reason`).
- `DocumentVersion`: immutable snapshot on each accepted change and on finalize.
- `GenerationLog`: mirrors `srs_generation_logs`.
- `ExpertReview`: reviewer pseudonym, blinded document label, ratings 1 to 5 for the four dimensions, per-section comments.
- `SusResponse`: ten answers 1 to 5, computed score 0 to 100, free-text comment.

Persistence in Phase 1: a `PersistencePort` with an IndexedDB adapter (`idb-keyval`) holding everything, versioned with a schema version and simple migrations. A Supabase adapter replaces it later.

## 5.5 Mock engine requirements

The mock engine must feel like the real system and be good enough to demo and to test the UI honestly.

- Deterministic by seed (so tests and screenshots are stable), with randomized latency inside ranges. Total generation default around 25 to 40 seconds, adjustable in devtools (instant, normal, slow).
- Chapters are drafted one at a time, in order, each producing a believable `section_drafted` event followed by a `guardrail_report`.
- Retrieval step emits 5 to 8 `RetrievedChunk` objects with source dataset (PURE, PROMISE_exp, Kaggle), a similarity score with irregular decimals, and a short excerpt. These appear in the inspector as "Konteks referensi", making the RAG visible.
- Guardrail reports must show real before/after rewrites of ambiguous phrases (cepat, mudah, fleksibel, efisien, optimal) into measurable statements, so the feature is visible and testable.
- Revision requests produce a proposal containing the old text and a new text that visibly applies the instruction (for the two example instructions in FR-HITL-02, ship hand-written fixtures; for any other instruction, apply a plausible templated edit plus a clearly marked appended clause). Regeneration touches **only the target section**; other sections' text must be byte-identical afterward (write a test for this, it is FR-HITL-03).
- Failure injection from the devtools drawer: fail at retrieval, fail at a chosen chapter, fail on guardrail, revision timeout. The UI must recover gracefully (retry, resume from the failed chapter, keep completed chapters).
- Fixtures: three complete projects in different domains. See section 8.

## 5.6 Backend-readiness scaffolding (create now, implement later)

Create these files with real content, but they are **inert**:

- `infra/docker-compose.yml` containing the n8n service exactly as in the SRS (image `docker.n8n.io/n8nio/n8n:latest`, container `n8n-orchestrator`, port 5678, `GENERIC_TIMEZONE=Asia/Jakarta`, volume `n8n_data`). Add a header comment: not used in Phase 1.
- `supabase/migrations/0001_init.sql` with `create extension if not exists vector;`, `srs_knowledge_base` (`embedding vector(1536)` with a comment to match the embedding model dimension), the HNSW cosine index, and `srs_generation_logs`. Add tables the UI will need later (projects, sections, document_versions, expert_reviews, sus_responses, rouge_results) mirroring the entities, each with a comment pointing to the entity.
- `n8n/README.md`: describe Workflow 1 and Workflow 2 node by node (Webhook, Vector Retrieval, Loop Over Items, Prompt Construction, DeepSeek API call, Quality Guardrail, Section Aggregator, Webhook Callback; Revision Trigger, Query Refinement, Targeted Regeneration, Callback), including the exact payloads and a table mapping each node to the `GenerationEvent` it will produce.
- `apps/web/src/app/api/*` route handlers that validate the incoming request with the shared Zod schema, then return HTTP 501 with a JSON body `{ error: "not_implemented", phase: 2, doc: "docs/backend-roadmap.md" }`. `webhooks/srs-ready/route.ts` must validate the callback payload schema and document the idempotency expectation (callbacks can be retried).
- `apps/web/src/services/http/*`: one adapter per port. Each method throws `NotImplementedError` with a pointer to the roadmap. Include the real endpoint paths and typed `fetch` wrappers where trivial.
- `.env.example` and a typed env loader in `shared/config/env.ts`: `NEXT_PUBLIC_DATA_MODE=mock|live`, `N8N_BASE_URL`, `N8N_WEBHOOK_SECRET`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DEEPSEEK_API_KEY` (server-only, never `NEXT_PUBLIC_`). In `live` mode with missing config, show a clear configuration error screen, not a crash.
- `docs/backend-roadmap.md`: ordered Phase 2 plan (Docker and n8n up, Supabase and pgvector, ingestion pipeline with the 80:20 anti-leakage split and 300 to 600 token section-based chunking, Workflow 1, Workflow 2, PDF parse service, compiler service, evaluation scripts, switch `DATA_MODE`), each step naming which adapter it replaces and which acceptance test proves it.
- `docs/contracts.md`: generated or hand-written reference of every schema in `packages/contracts`, with the n8n payloads.

## 5.7 Prompt templates as data

Store the chapter prompt template from the SRS (system role, retrieval context block, user specification block, imperative instructions, JSON-only output schema) in `n8n/prompts/chapter-3-specific-requirements.md` with `{retrieved_context}`, `{project_title}`, `{domain}`, `{raw_text}` placeholders. Add skeleton files for chapters 1, 2, and 4. The Phase 1 UI does not execute them, but the template registry (`SrsTemplate`) references them so the connection is established.

## 5.8 Extension points to keep clean

Feature flags in `shared/config/flags.ts` (for example `researchMode`, `aiRevision`, `versionHistory`, `comments`). Section registry driven by `SrsTemplate`. Typed event bus for cross-feature notifications. Permissions-ready data (`ownerId` on projects). Everything that would obviously change when there are many projects, many users, or a second standard should be a parameter or a registry entry, not a conditional in a component.

---

# 6. DESIGN DIRECTION

This is the part that most needs your judgment. Read it fully before writing any UI.

## 6.1 What "AI slop" design is, and why we are avoiding it

Research this was done against current sources. The consistent finding: AI slop is "distributional convergence", meaning the output you get when nobody overrides the statistical median of the training data. Users have learned to recognize it, and it now signals that nobody designed the product. The recurring tells:

- Inter (or another default system sans) everywhere; semibold body text.
- Blue-to-purple or indigo gradients; gradient text on headings or metrics; cyan accents on near-black.
- The same three rounded cards in a row; one border radius on everything; the same soft grey drop shadow under every card.
- Glassmorphism and backdrop blur used as decoration; glowing borders.
- Emoji, sparkles, rockets, lightning bolts as icons or bullets; pulsing status badges.
- Every screen treated like a marketing landing page: giant centered hero, tagline, "Get started" button, stats row of round numbers.
- Tailwind default semantic colors (emerald-500 green for success, etc.).
- Dark mode made by inverting light mode.
- Body copy stretched to container width; no asymmetry; no hierarchy beyond size.
- Generic placeholder content: John Doe, Acme Corp, "Empower your business with innovation", 1,000+ users, 99.9% uptime.
- Template chrome: a tracked-out ALL-CAPS eyebrow above every heading, spaced-em-dash labels, middle-dot meta strings, a "→" appended to every link, numbered markers (01 / 02 / 03) on content that is not actually a sequence, mono type used purely as a "techy" flourish.
- Redundant text that restates what the UI already shows.

We are not allowed to produce any of this. Section 15 turns it into an automated self-audit.

## 6.2 The concept: a proofreading desk

The product's subject is a formal document that a person reads, marks up, corrects, and signs off. So the interface is a **proofreading desk**, not a SaaS dashboard.

- **The manuscript is the hero.** The SRS is shown as a sheet of writing with real typographic care: a text serif, a comfortable measure, requirement IDs set in the left margin like marginalia, hairline rules between chapters. The chrome around it is quiet and dark.
- **Gold is the proofreader's marker.** The yellow in this product is used the way a yellow highlighter is used on paper: to mark where a human should look. Gold appears on (a) the current focus, (b) text the AI changed or rewrote, (c) the primary action on a screen, (d) keyboard focus rings, (e) the single active step of a process. Everything else is neutral black, ink, and stone. If gold is on more than roughly 5 percent of any screen, you used too much.
- **One memorable thing.** The memorable thing is the **margin ledger** in the workspace: requirement IDs and guardrail annotations living in the margin beside the text they refer to, with gold highlighter marks over rewritten phrases. Keep everything else disciplined and unremarkable so this reads.

Do not add decoration that does not serve this idea.

## 6.3 Color tokens

Define as CSS variables in `styles/tokens.css`; map into Tailwind `theme.extend.colors`. Components must reference semantic tokens only, never raw hex. Light and dark are **designed separately**, not inverted.

Dark (primary experience):

```
--bg:            #0B0A08   /* warm black canvas */
--surface-1:     #12110E   /* panels */
--surface-2:     #1A1813   /* raised: editor chrome, popovers */
--surface-3:     #232018   /* hover / selected rows */
--line:          #2B2820   /* hairlines */
--line-strong:   #3A3629
--ink:           #ECE8DD   /* primary text */
--ink-2:         #B5AE9E   /* secondary text */
--ink-3:         #8A8472   /* tertiary, placeholders (verify AA on --bg) */
--gold:          #E6B422   /* the marker */
--gold-bright:   #F5CB45   /* hover / emphasis */
--gold-deep:     #9B7A12   /* borders on gold surfaces */
--gold-wash:     rgba(230,180,34,0.14)   /* highlighter background */
--on-gold:       #1A1403   /* text on gold fills */
--positive:      #98A862   /* olive, deliberately not emerald */
--danger:        #D1634D   /* terracotta red */
--paper:         #F3EFE4   /* the manuscript sheet when "sheet" view is on */
```

Light:

```
--bg:            #F6F5F1
--surface-1:     #FBFAF7
--surface-2:     #EFEDE6
--surface-3:     #E6E3D9
--line:          #DDD9CE
--line-strong:   #C9C4B5
--ink:           #15130E
--ink-2:         #4F4A3F
--ink-3:         #6B6552
--gold:          #E6B422   /* fills only */
--gold-text:     #8A6A00   /* gold used as text or icon on light backgrounds */
--gold-wash:     rgba(230,180,34,0.32)
--on-gold:       #15130E
--positive:      #5C6E2E
--danger:        #B4432F
--paper:         #FFFFFF
```

Rules: body text and UI text must meet WCAG AA (4.5:1), large text and non-text UI 3:1. Write `scripts/check-contrast.mjs` that reads the tokens and fails the build if any declared pairing fails. No pure `#000` or `#FFF` for large surfaces other than the light-mode sheet. No gradients on text, ever. A single subtle noise overlay at 3 to 4 percent opacity is allowed on the dark canvas to avoid flat black, as a fixed pseudo-element with `pointer-events: none`; skip it under `prefers-reduced-transparency` and in print.

## 6.4 Typography

Three families, clearly distinct, via `next/font`. **Do not use Inter, Roboto, Arial, system-ui as the main face, or Geist.**

- **Document and display serif:** Literata (variable, optical size axis). Used for the manuscript body (17px / 1.7, measure capped at about 68ch), chapter headings, and the page title of each screen. Weight 400 body, 500 headings. Never 700 in the serif.
- **Interface sans:** Schibsted Grotesk. Used for all UI text: labels, buttons, tables, nav. Body UI at 14 to 15px, weight 400; labels 13px weight 500. Never semibold on running text.
- **Monospace:** JetBrains Mono, **only** for genuine identifiers and code: requirement IDs (`REQ-F-01`), session IDs, file names, code blocks in the Markdown. Not as a "techy" flourish on random labels.

If any of these fail to load or look wrong, choose a comparable distinctive alternative and record why in `docs/design-system.md`. Do not fall back silently to a default.

Type scale (px): 12, 13, 14.5, 17 (manuscript), 22, 30, 44. Tabular numerals (`font-variant-numeric: tabular-nums`) wherever numbers align (tables, timers, scores). Sentence case everywhere in the UI. **No tracked-out all-caps eyebrow labels.** No single-word accenting inside headlines (no one italic word, no one gold word). Headlines are plain and quiet; the serif carries the personality.

## 6.5 Shape, elevation, spacing

- Radius is semantic: `2px` for inline marks and tags, `4px` for inputs and buttons, `8px` for panels and dialogs, `0` for the manuscript sheet and tables. Pills only for the theme/locale switch.
- Structure comes from hairlines (1px `--line`) and tonal layers, not shadows. Dark mode uses no shadows at all except a single `0 24px 48px -24px rgba(0,0,0,0.6)` under modal dialogs. Light mode may use one very soft ambient shadow on popovers and dialogs only.
- Spacing on a 4px base with intentional rhythm: tight inside tables and the contents rail, generous around the manuscript (at least 64px side margins on desktop).
- Never place three identical cards in a row. If a screen needs a set of items, use a ledger (rows), a split layout, or a deliberately unequal arrangement.

## 6.6 Layout system

App chrome: a single thin top bar (48px). Left: the brand wordmark in the serif and a breadcrumb. Right: locale switch, theme toggle, settings. No heavy left sidebar on the ledger, new-project, export, or evaluation screens.

**Workspace (the core screen), three zones, desktop first:**

```
+--------------------------------------------------------------------------------+
| Naskah / Sistem Manajemen Rumah Sakit / v0.3                 id  gelap  setelan |
+----------------+--------------------------------------------+------------------+
| Daftar isi     |  1  Introduction                           | Inspektur        |
| 1 Intro   done |     1.1 Purpose                            |  Bagian 3.2      |
| 2 Overall      |  ...                                       |  Status: draf AI |
| 3 Specific  *  |  3.2 Functional Requirements   [Edit][AI]  |  Guardrail       |
|   3.1 Ext.     |  REQ-F-01  Sistem harus ...                |   4 dimensi      |
|   3.2 Func  <  |  REQ-F-02  Sistem harus ...                |   3 penulisan    |
|   3.3 Perf     |  ...                                       |   ulang          |
| 4 Supporting   |                                            |  Konteks referen |
|                |                                            |  Riwayat versi   |
+----------------+--------------------------------------------+------------------+
 264px             manuscript column, centered, max ~760px      320px, collapsible
```

- The center column is a sheet in `--paper` (dark mode default: sheet is rendered on `--surface-1` with ink text, with a "Lembar kertas" toggle to show a true paper-white sheet for people who prefer to proof on light). Left-aligned text; no justified text.
- Requirement IDs sit in the left margin of the sheet, mono, `--ink-3`, becoming `--gold` only for the selected requirement.
- Rewritten phrases carry a gold-wash highlighter mark; hovering or focusing it opens the margin note showing the original vague phrase and why it was rewritten.
- The right inspector collapses to icons below 1280px and becomes a bottom sheet below 900px. The contents rail becomes a drawer below 900px.

**Ledger (home):** not a card grid. A dense table-like list: project title (serif), domain, status, a four-segment progress bar (one segment per IEEE part, filled by section status), last edited, and a row action menu. One "Lanjutkan" row pinned above for the most recent unfinished project. Asymmetric header: page title left, quiet summary text right (counts by status), primary "Proyek baru" button.

**New project:** asymmetric split. Left, a narrow column (about 320px) with concrete guidance about what input produces better drafts (specific, derived from the real constraints: more actors and rules produce more requirements; include numbers you already know; transcripts work). Right, the form. No illustrations. No stock imagery.

**Imagery policy:** no stock photos, no AI-generated illustrations, no decorative blobs, no emoji. Visual interest comes from typography, rules, the margin ledger, and a small set of custom inline SVG marks (the logo mark, the empty-state drafting mark, the stage glyphs). Icons: one consistent line set (`lucide-react` is fine) at a fixed 1.5px stroke and 16 or 18px size; never colored gold except when active.

## 6.7 Component language

- **Buttons:** primary = gold fill with `--on-gold` text, 4px radius, no gradient, no glow, 36px height. Secondary = 1px `--line-strong` border, transparent. Tertiary = text only with underline on hover. One primary per screen region. Button labels are verbs that say exactly what happens ("Mulai buat dokumen SRS", "Terapkan perubahan"), no arrows appended.
- **Inputs:** `--surface-1` fill, 1px `--line` border, gold focus ring (2px, offset 2px) on keyboard focus. Visible labels above, helper text below only when it adds information.
- **Status:** small filled square marker (6px, radius 2px) plus text, not pulsing dots, not colored pill badges. Colors: pending = `--ink-3`, working = gold, ready = `--positive`, failed = `--danger`, locked = `--ink` with a lock icon.
- **Tabs, dialogs, popovers, tooltips:** Radix, restyled to the tokens, hairline borders, 8px radius, correct focus management and `aria-*` by default.
- **Toasts:** bottom-left, plain text with an action, same wording as the button that caused them ("Perubahan diterapkan"), auto-dismiss 5s, never emoji.
- **Tables (ledger, evaluation):** zero radius, hairline row separators, sticky header, right-aligned tabular numerals, no zebra striping.

## 6.8 Motion

Spend motion deliberately. The default AI approach (fade-and-slide-up on every section, hover lift on every card) is forbidden.

Allowed:
1. **One orchestrated moment:** when generation completes and the workspace first reveals, chapters resolve in sequence (opacity and a 4px translate, 240ms each, 60ms stagger), once per document load.
2. **Responses to the user's action:** dialog open/close, section expand/collapse, diff accept (the accepted words settle from gold-wash to plain ink over 600ms), step change in the tracker (the active step marker moves, the previous one fills).
3. **Progress:** a drafted chapter's text appears with a brief typewriter-less reveal (line by line, 18ms per line). No cursor blinking gimmicks.

Rules: durations 120 to 280ms for UI, ease-out cubic; no bounce, no spring overshoot, no parallax, no looping ambient animation, no pulsing. Honor `prefers-reduced-motion` by replacing all of the above with instant state changes.

## 6.9 Voice and copy

Words are design material. Rules:
- Indonesian UI copy is plain, polite, and direct. Sentence case. No exclamation marks. No marketing phrases ("revolusioner", "tingkatkan produktivitas Anda").
- Buttons and the toast that follows use the same verb. Names are consistent across the flow: "Bab" for chapter, "Draf" for draft, "Revisi AI" for AI revision, "Finalisasi" for finalize.
- Errors say what happened and what to do, in the product's voice, with no apology: "Konteks referensi gagal diambil. Bab yang sudah selesai tetap tersimpan. Coba lagi dari tahap ini."
- Empty states are invitations with one concrete action.
- Do not restate in text what the interface already shows.
- Fixture content must be specific and varied: realistic Indonesian system names and organizations, uneven numbers (for example 7 aktor, 43 kebutuhan fungsional, 1,8 detik), no lorem ipsum, no John Doe, no Acme, no round-number stats.

## 6.10 Accessibility and quality floor

Responsive down to 360px (mobile supports reading, reviewing, approving, and the SUS and review forms; heavy editing is desktop and tablet). Visible keyboard focus on everything. Full keyboard path through intake, workspace navigation, revision, diff accept/reject, and export. Landmarks and headings correct. `aria-live="polite"` on the progress tracker and toasts. Color is never the only carrier of meaning. Touch targets at least 40px on mobile. Respect `prefers-reduced-motion` and `prefers-color-scheme` (default to system, remember the user's explicit choice). Print stylesheet for the manuscript (see 7.5).

---

# 7. SCREENS AND BEHAVIOR

Build each screen with its full set of states: initial, loading (skeleton shaped like the real content, not spinners everywhere), empty, partial, error, success.

## 7.1 Project ledger (`/`)

- Lists projects from `ProjectRepository`, newest first, filter by status and search by title.
- First run (no projects): empty state with one primary action, "Mulai dari proyek kosong", and a secondary "Buka contoh proyek" that loads one of the three fixtures so a visitor can see a finished document immediately.
- Row actions: open, duplicate (new session id, copies input only), rename, delete (AlertDialog with the project title typed to confirm).
- Each row's four-segment progress reflects section statuses (pending, drafted, edited/revised, locked).

## 7.2 New project (`/new-project`), FR-IN-01 to FR-IN-03

Fields: Nama dokumen, Domain sistem (combobox with common domains plus free entry: Healthcare, Fintech, Education, E-commerce, Government, Logistics, Lainnya), Versi.

Input area with two sources that combine:
- **Textarea** for rough notes (FR-IN-01), auto-growing with a character count, no artificial limit under 50,000 characters, validation that it is not empty if no file is attached.
- **File drop zone** for `.pdf` and `.txt` (FR-IN-02). Multiple files allowed, each listed with name, size, page count, and status. Reject other types with a specific message. Max size configurable (default 10 MB).
- **Parser (FR-IN-03):** implement the cleaning as pure, tested functions in `entities/document/cleaning.ts`: strip control and non-UTF-8 characters, normalize whitespace, **re-join hard-wrapped lines into paragraphs**, detect and remove lines repeating on more than half of pages (headers/footers, page numbers), and merge sources into one corpus with source delimiters. The browser adapter uses `pdfjs-dist` to extract text per page, then runs the same cleaning. Show the result in a **raw text preview** panel (collapsible, per file, editable) before submission, plus a small summary: pages read, characters before and after cleaning, lines removed.
- The merged payload is shown as `raw_text` length and a tokens estimate, so the user understands what will be sent.
- **Submit:** "Mulai buat dokumen SRS" is disabled until valid. On submit: create the project, call `GenerationService.start`, and route to `/workspace/[id]` immediately, where the progress tracker is already running (as the SRS specifies).
- Persist the draft form in the store so navigating away does not lose input. Warn on leaving with unsaved input.

## 7.3 Workspace and generation progress (`/workspace/[id]`)

**While generating:** the workspace is visible and structured from the first second. The contents rail lists all sections as pending. A **progress ledger** sits at the top of the center column as a vertical list of the four real stages, each with a marker, a label, elapsed time (tabular mono is acceptable here since it is data), and, for stage 2, a sub-line per chapter that fills in as chapters complete. Completed chapters become readable immediately and can be scrolled while later chapters are still drafting; sections still pending show a skeleton shaped like their eventual content. A "Batalkan" action cancels via the handle. On failure the failing stage shows the error text, completed chapters remain, and "Coba lagi dari tahap ini" resumes from that chapter.

**When ready:** the stage ledger collapses into a one-line summary (duration, chunks retrieved, guardrail rewrites count) and the one-time reveal plays. The status becomes `in_review`.

**Manuscript (center)**
- Renders the Markdown with the typography in 6.4: chapter and section headings in the serif with their numbers in the margin; requirement blocks parsed from Markdown render as structured entries (ID in the margin, title, description, then actor/input/process/output as a small definition list, priority as a text marker). Raw Markdown remains the source of truth.
- Each section header has: **Edit** (FR-HITL-01), **Revisi AI** (FR-HITL-02), and an overflow menu (copy section Markdown, view history, lock/unlock).
- **Edit mode (FR-HITL-01):** toggling Edit swaps that section into `ManuscriptEditor` (Markdown source with side-by-side preview on wide screens, tabs on narrow). Typing never calls any service. Autosave to `DocumentRepository` after 800ms idle with a visible "Tersimpan" state; section becomes `edited` with source `human`. Provide Markdown toolbar basics, undo/redo, and a "Tambah kebutuhan fungsional" helper that inserts a correctly formatted requirement skeleton with the next free `REQ-F-NN` ID. Detect duplicate IDs and show an inline warning.
- **Locked sections:** a section can be locked (approved). Locked sections are read-only, show a lock marker, and are guaranteed untouched by any revision (FR-HITL-03). Editing a locked section requires an explicit unlock.

**Revisi AI dialog (FR-HITL-02, 03)**
- Opens from a section header. Shows the target section (number and title), the instruction textarea with 3 clickable example instructions drawn from the SRS (2FA and AES-256; QRIS use case; add audit trail to authentication), a character guide, and "Kirim revisi" (primary).
- While waiting, the dialog shows the real stages in plain language: "Merumuskan kueri pencarian baru", "Mengambil konteks tambahan", "Menulis ulang bab ini". On success it closes and the **diff viewer** opens. On failure it stays open with the instruction preserved and an actionable message.
- While a revision is pending for a section, that section shows a "Menunggu revisi" state; other sections stay fully editable. Two revisions on two different sections may run concurrently; a second revision on the same section is blocked with an explanation.

**Diff viewer (FR-HITL-04)**
- Side-by-side before and after, word-level, with a unified-view toggle. Additions get the gold-wash highlighter; removals are struck through in `--ink-3` with a `--danger` underline. Unchanged long runs are collapsed with "Tampilkan 12 baris tidak berubah".
- Shows the refined retrieval query and the extra reference chunks used, collapsed by default.
- Actions: **Terapkan perubahan** (writes the new text, creates a `DocumentVersion`, marks section `revised`, animates the accepted words from highlight to ink) and **Batalkan** (discards, restores the section state). Both are keyboard reachable (`Enter` and `Esc`), and closing the viewer by any other route asks for confirmation if the proposal is unresolved. Nothing is saved before one of these is chosen.

**Inspector (right):** tabs for the selected section: *Ringkasan* (status, source, word count, requirement count), *Guardrail* (four dimension verdicts with short reasons and the list of rewrites; clicking a rewrite scrolls to and focuses its highlighted phrase), *Konteks* (retrieved reference chunks with dataset badge, similarity, excerpt), *Riwayat* (version list with restore and a compare action that reuses the diff viewer).

**Finalize:** "Setujui dan finalisasi dokumen" in the top bar. A confirmation dialog lists unresolved items (sections still in revision, duplicate IDs, guardrail warnings that were never viewed), requires an explicit confirmation, locks every section, writes a final `DocumentVersion`, sets the project to `finalized`, and routes to `/export/[id]`.

## 7.4 Quality guardrail presentation

For each drafted section, show the guardrail as part of the manuscript, not a separate dashboard. A section header carries a compact four-part strip (unambiguous, complete, correct, verifiable) with a verdict marker for each. Each rewrite appears as a gold-wash phrase in the text with a margin note:

> Sebelumnya: "sistem harus cepat". Sekarang: "waktu respons sistem tidak boleh melebihi 2 detik pada beban 500 pengguna konkuren". Alasan: dapat diuji.

A user can revert a single rewrite to the original phrase or accept it (accepting just removes the highlight; reverting edits the text and marks the section `edited`).

## 7.5 Export (`/export/[id]`), FR-EXP-01, FR-EXP-02

- Displays the finalized document read-only with the same manuscript renderer.
- A summary column: number of functional requirements, number of requirements by priority, number of guardrail rewrites, actual generation time against the manual baseline cited in the proposal (4 to 24 hours for a novice engineer, shown as a sourced range, not as a claim about this system), validation status, structure completeness percentage.
- **Compile and download:** `CompilerService.compile` with `"docx"` and `"pdf"`. In Phase 1 the mock compiler is **real**: it produces a genuine `.docx` in the browser with the `docx` package following the IEEE 830 template: cover page, automatic table of contents field, hierarchical numbering (1, 1.1, 1.1.1), Times New Roman 12pt, 1.5 line spacing, margins 4 cm left, 4 cm top, 3 cm right, 3 cm bottom, captioned tables, page numbers. The PDF path uses a dedicated print route (`/export/[id]/print`) driven by `print.css` and a "Simpan sebagai PDF" action that opens the browser print dialog with the right page setup, as the Phase 1 stand-in for the LibreOffice/WeasyPrint service. Both sit behind `CompilerPort`, so Phase 2 swaps them for the server compiler without UI changes.
- Download state machine per format: idle, compiling, ready (with filename and size), failed (with retry).
- In research mode, a quiet prompt after the first download invites the participant to fill in the SUS form.

## 7.6 Evaluation area (`/evaluation`), RQ1 to RQ3

Tabs: *Ringkasan*, *Penilaian pakar*, *SUS*, *ROUGE*.

- **Ringkasan (RQ1):** table of `GenerationLog` rows (scenario, domain, status, duration, structure completeness) with success rate, mean duration, and mean completeness computed live; per-scenario drill-down showing which required headings are missing. Implement the regex structural checker in `entities/evaluation/structure.ts` (checks Pendahuluan/Introduction, Deskripsi Umum/Overall Description, Kebutuhan Spesifik/Specific Requirements, Use Case, Glosarium/Glossary and the subsections the template marks required), pure and unit tested. CSV export of the logs.
- **Penilaian pakar (RQ2 blind review):** a form where a reviewer sees "Dokumen A" or "Dokumen B" (the source is masked; the mapping to system or human baseline is held in the store and revealed only in the summary after submission). Each document is rated 1 to 5 on the four dimensions with a labeled scale (1 sangat tidak sesuai to 5 sangat sesuai), with a required justification field per dimension and optional per-section comments. Navigation between the two documents without losing answers. Submissions list with aggregate mean, median, and standard deviation per dimension per source, and a note that the Wilcoxon signed-rank or Mann-Whitney U test is computed in the evaluation scripts; import of that script's JSON output is displayed in the tab.
- **SUS:** the ten standard items in Indonesian, 1 to 5 scale, odd and even polarity preserved, one item per step on mobile and all ten on desktop. Score computed with the standard formula (odd items: response minus 1; even items: 5 minus response; sum times 2.5), implemented as a pure tested function in `entities/evaluation/sus.ts`. Result shows the 0 to 100 score against the 68 benchmark and an adjective interpretation (cite Bangor, Kortum and Miller 2009 and Sauro 2011 in a small footnote). Keep the item list in a data file so the researcher can swap in her validated translation:
  1. Saya rasa saya akan sering menggunakan sistem ini.
  2. Saya merasa sistem ini terlalu rumit untuk digunakan.
  3. Saya merasa sistem ini mudah digunakan.
  4. Saya rasa saya membutuhkan bantuan orang teknis untuk dapat menggunakan sistem ini.
  5. Saya merasa fungsi-fungsi pada sistem ini terintegrasi dengan baik.
  6. Saya merasa terlalu banyak ketidakkonsistenan pada sistem ini.
  7. Saya membayangkan kebanyakan orang akan belajar menggunakan sistem ini dengan cepat.
  8. Saya merasa sistem ini sangat merepotkan untuk digunakan.
  9. Saya merasa sangat percaya diri menggunakan sistem ini.
  10. Saya perlu belajar banyak hal sebelum dapat menggunakan sistem ini.
- **ROUGE:** a table of ROUGE-1, ROUGE-2, ROUGE-L (precision, recall, F1) per scenario, populated by importing the JSON/CSV the Python script will produce (define the schema in contracts). Include a plain-language note, in the UI, that ROUGE measures lexical overlap and is read alongside expert scores. In Phase 1 ship a sample import file so the tab is demonstrable.
- All evaluation data is exportable (CSV and JSON) from each tab.

## 7.7 Settings (`/settings`) and devtools

- Settings: language, theme (system, terang, gelap), sheet style (dark sheet or paper sheet), research mode, data mode display (read-only: "mock"), reset local data (AlertDialog).
- Devtools drawer (toggle with `Ctrl+Shift+D` and visible in settings when enabled): simulation speed, failure injection, "load fixture project", "clear all data", and a read-only view of the last 50 port calls (for debugging contracts). It must be impossible to open accidentally in a production build unless `NEXT_PUBLIC_ENABLE_DEVTOOLS=true`.

---

# 8. FIXTURES

Write fixtures as typed TypeScript data in `services/mock/fixtures/`, validated against the contracts at test time.

1. **Sistem Manajemen Rumah Sakit** (Healthcare), the SRS's own example. Complete, finalized-quality document: all four parts, around 35 to 45 requirements with unique IDs, an external interfaces section, performance and security requirements with measurable values, six or more use case narratives, and a traceability matrix table. Include at least four guardrail rewrites with before/after phrases.
2. **Aplikasi pembayaran UMKM dengan QRIS** (Fintech). A mid-length document, drafted but unreviewed.
3. **Perpustakaan digital kampus** (Education). A short document in `failed` state at chapter 3, to demonstrate recovery.

Also include 12 realistic `GenerationLog` rows across domains with varied durations and completeness (not round numbers, a couple of failures), 6 `RetrievedChunk` samples per domain, and a sample ROUGE import file.

---

# 9. REQUIREMENTS TRACEABILITY (YOU MUST MAINTAIN THIS)

Create `docs/traceability.md` mapping each of `FR-IN-01..03`, `FR-HITL-01..04`, `FR-EXP-01..02` to: the route/component that implements it, the port it uses, the test that covers it, and its Phase 2 backend counterpart. Keep it updated; it will be useful in the thesis (BAB IV) and for the evaluators.

---

# 10. STATE, ROUTING, PERFORMANCE

- URL is the source of truth for navigation: `/workspace/[id]?section=3.2&panel=guardrail` deep-links to a section and inspector tab.
- Zustand slices per feature; selectors, not whole-store subscriptions. Hydrate from IndexedDB before first render of data-dependent screens, with skeletons, and handle `QuotaExceededError` and schema mismatches with a clear recovery screen.
- Large documents (500+ requirements) must stay responsive: virtualize the manuscript sections or lazy-render offscreen sections; memoize Markdown parsing per section.
- Initial JS for the ledger under 200 KB gzipped; load `pdfjs-dist`, the editor, `docx`, and `diff` lazily (dynamic import) only where used.

---

# 11. TESTING AND QUALITY GATES

Unit tests (Vitest), required:
- PDF/text cleaning functions (hard-wrap re-joining, header/footer removal, control character stripping).
- Requirement parsing and next-ID generation, duplicate ID detection.
- Structure checker percentage calculation.
- SUS scoring (including a known worked example from Brooke 1996 or Sauro 2011, and edge cases all 1s and all 5s).
- Partial update isolation: after a mock revision accept, every other section's markdown is byte-identical.
- Contract tests: every mock output validates against the Zod schemas; every `http` adapter's request builders produce payloads that validate against the SRS payload schemas (`generate-srs`, `revise-srs`).

Component and E2E (Playwright), required flows: create a project from text only; create from a PDF plus text; watch generation complete; edit a section directly; request an AI revision, accept it; request another, reject it; failure injection and resume; finalize; download `.docx` (assert file opens as a zip with `word/document.xml`); submit a SUS response and see the score; submit a blind review. Run each in light and dark. Capture screenshots at 1440, 1024, 768, and 390 widths for the ledger, new project, workspace (generating and ready), diff viewer, and export.

Gates before any phase is considered done: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm audit:slop`, `pnpm check:contrast` all pass.

---

# 12. DOCUMENTATION DELIVERABLES

`README.md` (run instructions for Windows, mock mode vs live mode), `docs/architecture.md` (ports/adapters diagram as Mermaid, event flow, import rules), `docs/design-system.md` (tokens, type, components, usage rules, with the reasoning for gold-as-marker), `docs/contracts.md`, `docs/backend-roadmap.md`, `docs/traceability.md`, and `docs/decisions/` with short ADRs for: ports/adapters, event-stream generation, data-driven templates, client-side compiler as Phase 1 stand-in, no shadcn defaults.

---

# 13. PHASED EXECUTION PLAN

Complete in order. Each phase ends with the gates in section 11 and a short report.

**Phase 0, plan and scaffold.** Read this whole prompt. Write `CLAUDE.md`. Produce a short **design plan** before any UI code: the token set, type roles, layout concept with ASCII wireframes of the workspace and the ledger, and the principles. Then review that plan against section 6.1 and state which parts you changed because they resembled a default. Create the pnpm workspace, the Next app, `packages/contracts`, lint/format/test tooling, the import-boundary lint rule, and the repository layout with placeholder READMEs.

**Phase 1, contracts and ports.** Zod schemas for every entity and every n8n payload (section 2.3), the ports, the typed errors, the registry, the env loader. Contract tests. Nothing visual yet.

**Phase 2, design system and shell.** Tokens, fonts, themes with no flash, i18n skeleton, Radix-based primitives restyled to the tokens, the top bar, the contrast checker, and a hidden `/design-system` route (dev only) showing every primitive in both themes. Screenshot it.

**Phase 3, mock engine.** Persistence adapter, fixtures, generation event stream, guardrail reports, revision proposals, failure injection, structure checker, log recording. Tested without UI.

**Phase 4, intake and ledger.** Ledger, new project, text and file input, the cleaning functions and parser adapter, preview, validation, create and route to the workspace.

**Phase 5, workspace.** Manuscript renderer, contents rail, progress ledger, generation lifecycle including failure and resume, inspector, deep links.

**Phase 6, human-in-the-loop.** Direct editing and autosave, locking, the AI revision dialog, partial update isolation, the diff viewer, guardrail rewrite accept/revert, version history and restore.

**Phase 7, finalize and export.** Finalize flow, export page, real `.docx` compiler, print route for PDF, summary metrics.

**Phase 8, evaluation instruments.** All four evaluation tabs, research mode, SUS prompt, CSV/JSON export, sample ROUGE import.

**Phase 9, backend-readiness pass.** Complete section 5.6 and section 12. Write `docs/backend-roadmap.md` so that a developer who has never seen this repo can start Phase 2 on day one. Verify that flipping `NEXT_PUBLIC_DATA_MODE=live` with missing config shows the configuration error screen and that, with a fake config, the `http` adapters fail with `NotImplementedError` surfaced as a friendly message rather than a crash.

**Phase 10, polish and audit.** Run the full Playwright suite and screenshots, run the anti-slop audit, fix everything it finds, then do a manual critique pass: look at every screenshot in both themes and remove one accessory per screen. Write the final report.

---

# 14. DEFINITION OF DONE FOR PHASE 1

- Every flow in section 7 works in the browser with no backend running, in light and dark, in Indonesian and English, from 360px to 1440px wide.
- No component imports from `services/mock` or `services/http`. Switching `NEXT_PUBLIC_DATA_MODE` changes only the registry's choice of adapter.
- All n8n payloads and callbacks have shared Zod schemas, and the mocks conform to them.
- FR-IN-01 to FR-EXP-02 are each demonstrably implemented and listed in `docs/traceability.md`.
- Revision isolation (FR-HITL-03) and diff accept/reject (FR-HITL-04) are covered by passing tests.
- A real `.docx` downloads with the IEEE 830 layout described in 7.5.
- The scaffolding for Docker/n8n, Supabase/pgvector, ingestion, evaluation scripts, and the compiler service exists as documented, inert files.
- `pnpm audit:slop`, `pnpm check:contrast`, typecheck, lint, tests, and build all pass.

---

# 15. ANTI-SLOP SELF-AUDIT (BUILD IT, THEN PASS IT)

Create `scripts/audit-slop.mjs`, run by `pnpm audit:slop`. It scans `apps/web/src` and fails with a readable report on:

- Any import or usage of the font families Inter, Roboto, Arial, or Geist as a primary face.
- `bg-gradient-*`, `linear-gradient`, `radial-gradient` on text or used for decoration (allow none by default; require an explicit allowlist comment with a reason).
- `bg-clip-text` or `-webkit-background-clip: text`.
- `backdrop-blur` or `backdrop-filter` anywhere other than the modal scrim (allow at most that one use).
- Tailwind default palette classes (`indigo-`, `purple-`, `violet-`, `fuchsia-`, `cyan-`, `emerald-`, `sky-`, `blue-` and the rest of the default color scale) in components. Only semantic token classes are allowed.
- Raw hex colors outside `tokens.css`.
- Emoji or pictographic characters in source, messages, or fixtures (Unicode emoji ranges), with the sparkle, rocket, and lightning glyphs called out specifically.
- `animate-pulse`, `animate-bounce`, `animate-ping`, or any infinite CSS animation outside the skeleton shimmer (and the shimmer must be disabled under reduced motion).
- Placeholder content strings: "lorem", "John Doe", "Jane Doe", "Acme", "Empower", "seamless", "revolutionize", "supercharge", "unlock the power", "10,000+", "99.9%".
- Title-case-all-caps tracked eyebrow patterns: `uppercase` combined with `tracking-` utilities.
- Three or more sibling elements with identical card classes in a single grid row (heuristic).
- More than one `rounded-*` value used on a single surface type, and any `rounded-full` outside the switch and avatar.

Then, separately and manually, answer these in the Phase 10 report with evidence from screenshots:
1. Cover the logo. Could this screen belong to any other product? What on this screen is specific to proofreading a formal document?
2. Where exactly is gold used on this screen, and is each use a marker (focus, change, primary action, active step)?
3. Is dark mode its own design or an inversion of light?
4. What did you remove in the last pass?

---

# 16. FINAL REPORT FORMAT

When all phases are complete, reply with: what exists and how to run it (Windows commands first), a table of FR-IDs to implemented locations, anything simulated and how, known gaps or deviations with reasons, the first five steps of Phase 2 in the order you recommend, and the screenshots directory. Keep it factual and short.
