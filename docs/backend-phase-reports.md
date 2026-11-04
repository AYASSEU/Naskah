# Backend phase reports

## B0 — reconnaissance

Read the complete Phase 2 brief, Phase 1 ports/contracts, architecture and traceability. Enumerated both MCP servers and inspected n8n workflows, preferences, credential inventory and node catalog. Verified n8n version, health, public API authentication, credential schemas and installed PATCH controller. No hosted Supabase project was modified.

Baseline gates: typecheck, lint, 29 unit tests, production build, design audit, 26 contrast pairs all pass. Supabase local availability and container-to-host probes depend on B1 startup. Credential write probe follows local key provisioning. Dataset downloads and corpus-level validation belong to B4, and are not claimed complete here. Deviations and sources: ADR 002.

## B1 — database

Local Supabase CLI 3.0.0 started the isolated `naskah` stack (API 54321, database 54322, Studio 54323). Initial timestamp came from the CLI clock; the report uses the user's 2026-11-05 timezone. The migration and seed applied successfully. Generated TypeScript types come from this running schema.

Verified `node scripts/test-database.mjs`: anonymous GET and POST denied for all 27 public tables; actual authenticated owner isolation, encrypted-store denial, one open revision per section, optimistic version rejection, locked-section rejection, atomic revision target isolation, anti-leakage rejection and model mismatch rejection. Test rows roll back. Security/performance advisors at warning/error level report no issues. n8n reaches Supabase via host.docker.internal:54321. The app was not running during the callback connectivity probe; that acceptance remains for B6.

Gate: typecheck, lint, 36 tests (including foundation security tests developed while Docker downloaded), production build, design audit and 26 contrast pairs pass. Independent B2 work overlapped the first image download; its own completion gate is separate. Replaced the unapplied scaffold, retained SRS table names, and added explicit grants because current Supabase supports closed-by-default tables. See ADR 002.
