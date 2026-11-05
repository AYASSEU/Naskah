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

## Remaining implementation

B5–B10 are still pending: shared Markdown renderer/parser, generation/revision/error workflows and execution tests; complete application routes/adapters and callbacks; server PDF/DOCX compiler; research evaluation services/scripts; full live end-to-end acceptance; final runbooks. Only Settings and its supporting backend routes are live at this checkpoint. The frontend's default mode remains mock. Do not describe Phase 2 as complete.
