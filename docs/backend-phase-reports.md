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
