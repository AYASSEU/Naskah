# Backend phase reports

## B0 — reconnaissance

Read the complete Phase 2 brief, Phase 1 ports/contracts, architecture and traceability. Enumerated both MCP servers and inspected n8n workflows, preferences, credential inventory and node catalog. Verified n8n version, health, public API authentication, credential schemas and installed PATCH controller. No hosted Supabase project was modified.

Baseline gates: typecheck, lint, 29 unit tests, production build, design audit, 26 contrast pairs all pass. Supabase local availability and container-to-host probes depend on B1 startup. Credential write probe follows local key provisioning. Dataset downloads and corpus-level validation belong to B4, and are not claimed complete here. Deviations and sources: ADR 002.

## B1 — database

Local Supabase CLI 3.0.0 started the isolated `naskah` stack (API 54321, database 54322, Studio 54323). Initial timestamp came from the CLI clock; the report uses the user's 2026-11-05 timezone. The migration and seed applied successfully. Generated TypeScript types come from this running schema.

Verified `node scripts/test-database.mjs`: anonymous GET and POST denied for all 27 public tables; actual authenticated owner isolation, encrypted-store denial, one open revision per section, optimistic version rejection, locked-section rejection, atomic revision target isolation, anti-leakage rejection and model mismatch rejection. Test rows roll back. Security/performance advisors at warning/error level report no issues. n8n reaches Supabase via host.docker.internal:54321. The app was not running during the callback connectivity probe; that acceptance remains for B6.

Gate: typecheck, lint, 36 tests (including foundation security tests developed while Docker downloaded), production build, design audit and 26 contrast pairs pass. Independent B2 work overlapped the first image download; its own completion gate is separate. Replaced the unapplied scaffold, retained SRS table names, and added explicit grants because current Supabase supports closed-by-default tables. See ADR 002.

## B2 — server foundations

Implemented server-only environment validation, typed Supabase client and transaction helper, AES-256-GCM envelope, central redaction, signed local-owner sessions, same-origin guards, constant-time callback authentication, bounded JSON reads, rate limits and resumable SSE. Provider URL validation rejects private/link-local DNS answers and redirects, and checks the actual connection's DNS lookup to resist rebinding. Public deployment is rejected by the local-owner guard until a real authentication mode is implemented.

Verified: 39 TypeScript tests, including nonce uniqueness, associated-data binding, tamper rejection, redaction, private-address variants, signed-session tampering, cross-origin rejection, stale callbacks and SSE replay; Python decrypts the shared Node encryption vector and rejects an incorrect owner. Typecheck, lint, production build, design audit and 26 contrast checks pass. Local n8n internal credential creation and repeat PATCH bootstrap also pass. The shared vector contains deliberately public test material, not a provider key. Pinned the pre-existing frontend versions to prevent incidental upgrades while adding backend dependencies.

Deviation: direct Postgres transactions supplement the typed Supabase client for advisory locks and atomic multi-table operations; each application transaction explicitly assumes service_role. The browser still only calls same-origin routes. The limiter is process-local because this phase targets one local server; multi-instance deployment needs a shared limiter and real authentication.

## B3 — integrations and Settings

Implemented the declarative registry, live credential-schema validation, cached PATCH/PUT/recreate capabilities, serialized key saves, encrypted storage, rollback of previous credential/config on a failed smoke, binding recovery, authenticated smoke workflows, safe Settings routes and the live Settings ledger. Startup restores missing credentials without provider calls; an hourly doctor records readiness. New-project readiness blocks generation with links to missing connections/corpus. Fixed Next's localhost/127.0.0.1 request normalization without relaxing origin checks.

Verified real local Supabase and n8n with generated mock-provider keys: rejected invalid key before storage; create, PATCH rotation, deletion, missing-credential recovery, model/completion and 1536-dimensional embedding smokes; scanned DTOs, workflow definitions and available execution exports for test keys. The live browser saved another key through Settings, displayed all three completed states, cleared the key, left browser storage free of it and blocked generation on the empty corpus. Light and dark screenshots inspected. Gates: 43 unit tests, typecheck, lint, production build, design audit and 26 contrast checks.

Deferred to B5/B6 as specified by the phased brief: full generation after credential recovery, all-credential wipe recovery, production workflow deployment and active-run blocking after deletion. Only smoke workflows exist at this stage. Recreate fallback is unit-tested because installed n8n supports PATCH. Workflow execution bodies are not persisted to avoid recording webhook authorization headers; webhook responses and database state are acceptance evidence. The read-only doctor currently covers integration/workflow/corpus readiness; infrastructure checks expand in B10. Startup-restored keys are marked synced, not tested, until an explicit smoke succeeds.

## B4 — ingestion

Implemented the Python fetch/split/chunk/embed/load/verify pipeline, provenance manifests, deterministic project-level held-out splits, conservative section detection, atomic requirement chunking, encrypted Settings key reuse, batch retry/resume, content-hash upserts and retrieval verification. Seven Python tests pass, including shared encryption, split reproducibility, token bounds, synthetic provenance, oversize rejection and interrupted-cache recovery.

Executed against local Supabase and the mock provider: 150 development chunks across five domains and five section groups; token estimates 386–426; dimensions 1536; no duplicates or held-out document IDs in retrieval. Both section-filtered retrieval checks passed. A repeated full run reused all 150 embeddings and kept the count at 150. Real-source preparation downloaded verified PURE ZIPs and PROMISE_exp, extracted 112 preliminary document/project groups, and stored 22 held-out documents separately. Research chunking intentionally failed on 16 oversize documents; no research embeddings were generated. Kaggle discovery found the exact candidate but its license is Unknown; download/provenance results and manual review instructions are recorded locally and in the ingestion guide.

Gates: typecheck, lint, 43 TypeScript tests, production build, design audit, 26 contrast checks, and seven Python tests pass. Docker Desktop/Supabase were already running when services were checked; the existing n8n and external runners were restarted without replacing volumes. Readiness returned HTTP 200 and the full credential lifecycle/smoke test passed after restart.

Deviations: token count is the documented characters/4 approximation. Whole-statement overlap may be below 10% to avoid cutting requirements. Development seed documents stay entirely in the development retrieval corpus and never become thesis references. Research preparation remains provisional until extraction gaps, oversized statements, alternate document versions and Kaggle terms are reviewed. These do not block generation implementation using the development corpus.

## Laptop recovery and B5 progress — 2026-11-09

Restored the runtime on the destination laptop at
`C:\Users\MSI1\OneDrive\文档\WebApp Skripsi` with the existing repository and history.
The old machine's database and encrypted credentials were not transferred. This
laptop uses n8n 2.46.6 and matching external runners, the existing local n8n volume,
and the transferred provider smoke workflows. The webapp responds HTTP 200 on
127.0.0.1:3000 in mock mode; n8n readiness is HTTP 200 on localhost:5678. The n8n MCP
connection successfully executed the transferred Hello World workflow and returned
its successful result. Local Supabase CLI 3.0.0 applied the existing migrations;
integrity/RLS checks for all 27 public tables and warning/error advisors passed.
Seven Python tests and the synthetic ingestion pipeline passed: 150 development
chunks, dimension 1536, no held-out leakage, and section retrieval checks passed.
Research datasets remain provisional as described in B4.

Started B5 with `packages/core`: shared IEEE template, lossless Markdown parser,
requirement parser, deterministic rendering, structure scoring, traceability and
rewrite markers, plus numeric-assumption and identifier-preservation checks.
Existing frontend imports delegate to the shared implementation. Golden files
cover all three Phase 1 manuscripts; Windows CRLF metadata, code fences, tables,
section isolation and multiline requirement fields are checked. Mock generation
now assembles each chapter heading once before scoring structure.

Built the authenticated `Naskah / Smoke / Markdown` workflow from source. Its small
Code-node bundle uses the same renderer and a JSON Schema validator generated from
the Zod chapter contract. The build rejects unsupported schema keywords. Isolated
execution tests confirm byte equality with the host renderer for all three mock
manuscripts and agreement with Zod on malformed inputs. The generated SDK passes
the live n8n MCP validator (two nodes). The deployment helper resolves credential
IDs at runtime, rejects ambiguous names, and preserves existing node IDs, positions
and groups. No provider keys or credential IDs are embedded in workflow artifacts.

Verified: 61 TypeScript unit tests, strict typecheck for core/n8n/web, lint,
production build, design audit and all 26 contrast pairs passed. Six selected
Playwright tests passed across light/dark: concurrent revision isolation, full text
intake through edit/revision/finalization/DOCX, and failed-generation resume.
The portable Windows startup command was executed against the existing services;
it retained the running web server and reused the containers. See
`docs/local-laptop-setup.md` for the exact commands and current addresses.

The user explicitly approved a new 30-day REST key with 14 scopes: credential
list/read/create/update/delete, workflow list/read/create/update/activate/deactivate,
and execution list/read/stop. Created `Naskah local backend`, expiring 9 December
2026, and stored it in the Windows user environment, gitignored app configuration,
and encrypted local Settings store. The earlier automatic approval block is
resolved. GET workflows/credentials, credential creation/PATCH, and workflow
create/update/activation now succeed. MCP OAuth remains limited to workflow:read,
workflow:execute, execution:read.

Created a consistent pre-deployment n8n backup at
`%LOCALAPPDATA%\n8n-backups\20261109-210943-bdf69a`. Deployed and activated
`Naskah / Smoke / Markdown` (local ID `RVzjRIskYWLWmFJf`). A real runner execution
initially exposed esbuild's export getters: n8n disables Object.defineProperty,
so the bundle returned undefined despite passing a normal VM test. Replaced the
getter export with a plain local result container, added a hardened-sandbox
regression, validated the rebuilt SDK, and reran the production webhook. All four
fixtures returned HTTP 200 with byte-identical Markdown (18,952; 9,821; 2,592; and
292 bytes); an invalid auth token was rejected. Repeated upserts retained the
workflow ID and node groups. Evidence is in ignored
`artifacts/n8n-markdown-verification.json`.

Recovered Settings using only the local mock provider. Fixed credential sync to
adopt an existing uniquely named/type-matching credential when the app binding is
absent or stale, refuse ambiguous names and foreign bindings, and retain existing
smoke-node positions and MCP visibility. Real setup verified all three transferred
credential IDs remain unchanged, five required credential names are unique, both
provider webhooks pass, and existing smoke IDs/layout/groups/MCP are preserved.
New callback and Supabase credentials were created using the live API schemas;
all app secrets use the existing AES-GCM envelope. The reusable command
`pnpm local:setup-mock` refuses non-mock provider configurations. Evidence is in
ignored `artifacts/local-mock-setup.json`. Database integrity was rechecked after
these writes; all 27 tables passed.

**At this 9 November checkpoint B5 was not complete.** W1 generation, W2 revision, W3 error handling, Supabase
smoke, and failure/repair/cancel/resume acceptance remain pending. Doctor correctly
returns not-ready because the three production workflows do not exist yet;
provider integrations and the 150-chunk development corpus are ready. Save-data
policies remain none; n8n may temporarily persist initial execution rows before
its configured pruning removes them. Webhook responses are the acceptance evidence.

## B5 — production workflows, 2026-11-10

Implemented and activated Generate SRS (14 nodes), Revise Section (14), Error
Handler (10), and Supabase smoke (15), using the live node catalog and successful
MCP SDK validation. Shared builders emit credential-name placeholders; CLI and
Settings reapply share one server deployer using the encrypted n8n connection.
Idempotent upserts preserve IDs, positions, groups and MCP flags. Parent workflows
point to the deployed error handler. Existing transfer workflows remain intact.

Generation loads active template/prompts and owner-scoped RAG context, condenses
long input with map/reduce, validates/repairs chapter JSON once, reflects with
conservative literal rewrites, checkpoints each part, renders shared Markdown,
and delivers an authenticated callback. Revision refines up to three queries,
receives only target text and reserved IDs, and stores a pending proposal.
The Error Trigger recovers safe parent metadata without saved execution bodies,
persists a stable error/checkpoint and delivers the failure callback.

Minimal transactional callback routes were brought forward from B6 to verify real
delivery, idempotency, freshness, lock/version checks and proposal isolation.
Explicit text-to-JSONB casts prevent postgres.js from double-serializing stored
arrays/objects; real persisted section tests cover this. The CLI-generated B5
migration adds runtime RPCs/event identity, trusted owner retrieval filtering and
template data. Generated database types match the running schema. Invoker RPCs
have an empty search path and service-only execution grants.

The local mock matrix checks real production webhooks, callbacks, database
events/checkpoints/metrics, byte-identical Markdown, and safe API execution
metadata. It covers provider and validation failures, repair, retry/backoff,
guardrails, long input, cancellation, resume, revision isolation, owner privacy,
callback replay/conflict/freshness and callback failure recovery. The ignored
`artifacts/b5-acceptance.json` holds exact case results. All provider calls use
dummy keys and synthetic development data; no paid provider calls were made.

Final gate: 26 real-webhook cases passed, with parent execution metadata inspected
through the API while active. All 76 TypeScript unit tests, strict core/n8n/web
typechecks, lint, production build, design audit and 26 contrast pairs passed.
Six Playwright cases passed across light/dark: concurrent revisions, intake through
edit/revision/finalization/DOCX, and failed-run resume. Database integrity/RLS for
27 tables, invoker/RPC grant checks, and warning/error advisors passed. Reapply
recovered all four deactivated workflows while preserving their layout and IDs.
The app was restarted after the build and responds HTTP 200 in mock mode.

See `B5-workflows.md` for the runbook, acceptance details and deviations: a pure
single-item planner loop replaces a dedicated Loop Over Items node; corrected
reflection objects are ignored in favor of validated literal rewrites; callbacks
use five total attempts. The planner bundle is larger than the small-Code-node
convention. Execution save policies remain none, but initial execution rows can
temporarily contain headers before pruning. Durable acceptance uses database
events and receipts; final execution body exports are deliberately absent.

## B6 — local backend UI, 2026-11-10

Connected project/document, generation and revision ports to local Supabase and
n8n through same-origin authenticated routes. Added pending sections, versioned
saves, histories/restores, duplicate-start serialization, scoped SSE replay,
resume/cancel and a watchdog. Optional port methods support atomic proposal
accept/reject and recovery after reload without changing mock-mode behavior.
The running UI now uses live backend adapters; providers remain local mock.
Docker's stopped engine was restarted and existing containers/volumes reused.

Acceptance exposed and fixed pending-section callback versioning, atomic
Markdown/requirements persistence, hidden revision annotations, input arriving
during autosave, and explicit current-versus-draft conflict review. Resume retains
human edits to completed checkpoints. Late callbacks cannot replace watchdog
decisions. A CLI-generated migration extends revision acceptance compatibly and
guards terminal RPC updates; database types were regenerated. The startup helper
handles the missing private Compose file by starting existing containers and
checking readiness, without replacing volumes or encryption keys.

The same port lifecycle runs against mock and HTTP adapters. The real HTTP matrix
checks cut/reconnected SSE, owner/origin denial, conflicts/locks/history, readiness,
one-run dispatch, concurrent/stale revisions, human-edited resume, cancel and
watchdog behavior. Live UI checks in both themes cover reload persistence, slow
autosave, conflicting tab edits, pending proposal recovery, isolated accept/reject,
finalization and real DOCX output. Automated tests use dummy keys and synthetic
inputs. Exact evidence is in ignored `artifacts/b6-acceptance.json`; final gate
results are recorded below.

Deviations: fetch SSE provides explicit session/cursor control instead of
EventSource. Server parser/compiler and research services stay with B7/B8; client
helpers were extracted and reused with real persisted documents. Server stubs
remain explicit. Unavailable execution-body exports use checkpoint resume.
Manual writes during generation are blocked to protect human work. See
`B6-local-ui.md` for operation, routes and remaining boundaries.

Final gate: 83 unit tests, strict typecheck, lint, production build, design audit
and 26 contrast pairs passed. All 10 B6 HTTP cases and all 26 B5 real-webhook
regressions passed. Two live UI cases passed across light/dark, including delayed
autosave, explicit conflict review and pending-proposal reload; six original
mock UI cases also passed. Database/RLS checks for 27 tables, security checks for
the five runtime/acceptance RPCs, and warning/error advisors passed. The strict
B5 resume regression also caught a checkpoint timestamp change on callback insert;
original chapter timestamps are now preserved. Startup was verified with the
private Compose file absent. The webapp was restored to live backend mode after
mock regression, with seven active workflows and the synthetic mock provider.
Changed-file secret/credential-reference scans passed; environment and artifacts
remain excluded from Git.

The final homepage check also found legacy workflow-only projects without a
document row. Owner-scoped reads now backfill only missing template/document rows
and display retained checkpoints without replacing existing sections. The added
HTTP recovery case passes and makes prior local projects usable in the ledger.

## Remaining implementation

B10 remains pending: real-study handoff and final documentation.
B8 evaluation is implemented below using synthetic development acceptance. B7 server parsing/compilation is complete as described below. Generate and Revise now work from the
UI with local n8n/Supabase and a mock provider. Phase 2 is not entirely complete.

## B7 — local parser and compiler, 2026-11-10

Multipart PDF/TXT routes and HTTP adapters now use a bounded local Docker parser
and shared Phase 1 cleaning. Fresh PDF worker processes pass 200 measured calls
after 20 warm-up calls; persistent RSS band was 6,684,672 bytes. Scanned, encrypted,
malformed, encoding, byte/page limits and origin/session/internal-bearer guards
pass. Five worker tests exercise timeout/output limits and failure mapping.

Finalized owner-scoped snapshots compile through Pandoc/reference DOCX/Lua
captions and Python/UNO to refreshed DOCX and real PDF. The UI accepts optional
cover author/institution and downloads both files through authenticated private
Storage streaming. Cache reuse/coalescing, attachment/privacy checks and removal
of project export objects are implemented. Existing tables/grants suffice.

Hospital acceptance: 22 A4 pages, 3 captioned tables, all 39 requirement IDs,
12 pt Times New Roman body/tables, 1.5 spacing, 4/4/3/3 cm margins, and TOC chapter
starts 4/6/8/18 matching the PDF. All 22 final rasterized pages were inspected;
continuation table headers and footers are intact. Six HTTP groups, four final
live UI cases across both themes and all ten B6 HTTP regressions passed. Standard
gates and mock UI regression are recorded with final verification below.

Deviations: cover fields use python-docx instead of Lua; the validated-AST DOCX
writer omits --sandbox because Debian Pandoc 2.17 cannot read DOCX resources in
that mode. The reader remains sandboxed. Private signed Storage URLs stay behind
the same-origin API. Work is bounded to two local jobs rather than a durable
distributed queue. Windows QA used the packaged renderer in a network-disabled
container since no bundled Windows LibreOffice exists. Full details and commands
are in B7-documents.md. No paid provider or real research data was used.

Final B7 gate: strict typecheck, lint, 83 unit tests, production build, design
audit and all 26 contrast pairs pass. All 20 original mock UI cases pass across
light/dark (the four live-only cases are skipped in that run). Local database/RLS
checks pass for 27 tables and warning/error advisors report no issues. The five
final process-worker cases also cover a failed parent leaving no descendant.
Generated screenshots from mock regression were restored to avoid unrelated
baseline changes. Temporary acceptance projects were removed; UI and startup
were restored to live backend mode with the local mock provider. Secrets and
portable credential-reference scans pass; runtime tokens/fonts/artifacts stay
out of Git. No push was performed.

The final Windows PowerShell 5 startup probe found its HTML parser requirement;
health probes now use -UseBasicParsing. The documented startup command succeeds
with existing containers and an already-running UI. Final HTTP checks: UI 200,
backend ready, compiler healthy and provider restricted to local mock port 4010.

## B8 — local research evaluation, 2026-11-11

Evaluation now persists through owner-scoped HTTP ports, with dev/research
participants, consented signed browser identities, frozen system/baseline cases,
random A/B mapping and immutable expert reviews/SUS. True source maps are stored
separately. Paired cases require both reviews before source summaries/export;
independent participants keep their randomized source across cases. Unblinding
is an explicit post-submission action. Server and database recompute SUS and
reject forged identities/scores or cross-scope records.

A pinned nonroot Docker Python service computes expert descriptions, SUS,
heading completeness, ROUGE-1/2/L and design-specific Wilcoxon/Mann–Whitney.
Participant means avoid pseudoreplication. Methods, ties/zeros, participant counts,
effect size/approximate bootstrap CI, Holm correction, seed and engine/input
provenance are retained. Imported reports are recomputed against owned current
inputs. JSON/CSV export uses scoped HMAC pseudonyms and excludes free text and
source documents; study design and safe calculation provenance remain available.
Numerical CLI operations disable container networking; the stdlib exporter uses
only the local owner API. No AI provider is called by evaluation.

Research cases/SUS require successful explicitly enrolled non-mock runs without
dev_seed retrieval. All acceptance uses synthetic dev data and research remains
empty. This does not validate a real study. Public respondent Auth, participant
recovery, study enrollment and a real research corpus remain future work. Local
single-owner blinding does not prevent the laptop operator inspecting the DB.
Finish planned cases before unblinding. Reader/input limits reject oversized
datasets explicitly; pagination for larger studies remains future work.

Security/performance advisors at warn/error report no issues for the local DB;
29-table integrity/anonymous-denial checks and evaluation trigger rollback tests
pass. Separate PL/pgSQL type lint reports three pre-existing implicit text-to-jsonb
return warnings in B5 naskah_workflow_failure; B8 evaluation functions are clean.
Migration replay produces an empty schema diff and local migration history is
aligned. The user-facing UI stays on the mock provider. See B8-evaluation.md.

Final B8 gate: strict typecheck, lint, 95 unit tests, production build, design
audit and all 26 contrast pairs pass. Python passes 19 tests, including shared
goldens and 100 randomized ROUGE-L reference comparisons. All seven B8 HTTP
groups pass, including consent/owner/origin boundaries, immutable blinding/SUS,
research exclusion, both study designs and verified offline import/export.
The final SUS/expert/statistics/ROUGE CLI examples and local exporter run.

All four B8 live browser cases pass across both themes, including late-response
scope switching and saved SUS after reload. Both B6 live generation/revision/
export cases, both B7 parser cases, all ten B6 HTTP regressions, and all twenty
original mock browser cases pass. An earlier parallel build locked Windows dev
files and interrupted workflow browser checks; the dev server was stopped for
a clean final build, then workflow checks passed after restart. Temporary test
participants/projects/reports were cleaned and generated baseline screenshots
restored. Secrets and portable credential-reference scans pass.

Windows PowerShell 5 startup succeeds with all local services. Final UI HTTP 200,
backend ready, seven active workflows, compiler/evaluation healthy, provider and
embeddings restricted to local mock port 4010, and research export empty. The
webapp is restored to live backend mode; no push or real study run was performed.

## B9 — connected local acceptance, 2026-11-11

Added whole-project live browser acceptance, owner-scoped synthetic cleanup,
encrypted test recovery and reproducible test:b9 orchestration. The pipeline uses
its own generated/revised manuscript for real server DOCX/PDF and evaluation,
including two expert/SUS identities, verified statistics/ROUGE and privacy exports.
SSE replay uses a positive cursor; failed generation resumes without repeating
the first chapter or losing a manual edit. Credential lifecycle tests verify
actual mock key hashes, not only green Settings indicators.

Found and repaired stale main-workflow references after credential deletion,
bulk recovery against n8n's active-workflow publication validation, phone-width
evaluation toolbar overflow and the live intake's simulation label. Binding
repair is restricted by managed workflow namespace, canonical credential name
and credential type. All missing credentials are recreated before a workflow
update; orphaned sibling references are healed together and incomplete/ambiguous
publication is blocked. No schema change or volume reset was required.

The Phase 1 fixture suite is selected separately in mock mode; live counterparts
test persisted entities and server features. Manual real-provider execution is
not performed under the user's mock-only restriction. Exact user steps and
remaining n8n/key/corpus requirements are in runbook.md; B10 remains pending.

Repeated acceptance exposed over 100 orphaned LibreOffice/GPG zombies in the
old compiler container, exhausting its 128-PID limit and eventually breaking both
exports and parsing. The helper now uses Docker --init and fingerprints that
runtime option, recreating only the stateless service. Thirty consecutive compile
jobs preserve zero zombies and a bounded idle process count. Parser soak samples
also wait up to three seconds for asynchronous temp cleanup to settle.

Final B9 gate: 99 unit tests, strict typecheck, lint, production build, design
audit and all 26 contrast pairs pass. The complete test:b9 invocation passes:
14 live UI cases across light/dark, 26 B5 real-webhook cases, ten B6 HTTP cases,
six B7 document groups, seven B8 evaluation groups, 19 Python numerical tests
and database integrity/anonymous denial for 29 tables. The 20 original mock UI
cases also pass separately. Five document-worker bounds/descendant cases pass.

Parser soak measures 200 calls after 20 warm-up calls, with RSS range 2097152
bytes. Thirty repeated compiles keep zero zombies and a stable three-process
probe count. The complete live suite now remains healthy after repeated exports.
The mock-UI preflight rejection is verified before a recovery snapshot is written.
Security/performance advisors report no warn/error issues. Repository, artifact,
public-bundle, workflow/execution and server-log credential scans pass.

Temporary synthetic projects, participants and derived reports were cleaned;
original provider settings were restored and the encrypted recovery snapshot was
removed. Generated baseline screenshots were restored. Final Windows PowerShell 5
startup succeeds; UI HTTP 200, live backend ready, seven active workflows, mock
provider port 4010, compiler init enabled, evaluator healthy and research export
empty. No real-provider execution, research promotion, schema reset or push was
performed. User-controlled real-provider steps remain in runbook.md.
