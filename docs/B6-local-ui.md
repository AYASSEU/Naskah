# B6: UI with local n8n and Supabase

Implemented on 10 November 2026 (Asia/Jakarta). The webapp uses **live backend
adapters** on `http://127.0.0.1:3000`, with local Supabase and n8n. The generation
and embedding providers remain the deterministic mock on port 4010. Automated
acceptance makes no paid provider calls. The synthetic development corpus is not
thesis evidence.

## Running it

From the repository root in PowerShell:

```powershell
./scripts/start-local.ps1
```

The default is now `-Mode live`: start Docker Desktop if needed, start/reuse the
existing n8n/mock containers, start Supabase, then start the webapp. The private
Compose file is used when present. On this laptop it was absent while containers
and volumes remained; the script instead starts the existing named containers
and checks readiness without recreating data or encryption keys. A listener on
3000 is preserved; stop the existing web server before changing its mode.
`-Mode mock` retains the original Phase 1 behavior.

`apps/web/.env.local` retains `NEXT_PUBLIC_DATA_MODE=live`, so `pnpm.cmd dev` also
uses the backend. Provider Settings remain mock. Browser calls stay same-origin
`/api/*`; keys and credentials stay server-side. No new permissions were required.

1. Open **Proyek baru**, enter a name and system description, then start generation.
2. Progress comes from n8n through SSE. Reload reconnects to the same run.
3. Edit a section after generation; saved text and versions survive reload.
4. Choose **Revisi AI**, submit an instruction, then review the diff. **Terapkan
   perubahan** commits only that target; **Batalkan** rejects the proposal.
   Pending proposals are recovered after reload.
5. Failed/cancelled runs resume using trusted database checkpoints. Human edits
   to completed sections are retained. Stalled runs become recoverable timeouts.

## Routes and consistency

Thin handlers delegate to `src/server/application/{api,data,runs}.ts`, using signed
local-owner sessions, origin guards, bounded requests, shared Zod contracts and
service-role transactions.

| Area | Routes |
| --- | --- |
| Projects | GET/POST `/api/projects`; GET/PATCH/DELETE `/api/projects/{id}` |
| Document | GET `/api/documents/{id}` |
| Section write | PUT `/api/sections/{sectionId}`, body `projectId`/`section`, required `If-Match` |
| Document history | GET/POST `/api/documents/{id}/versions`; POST `.../{version}/restore` |
| Section history | GET `/api/sections/{sectionId}/versions?projectId=...`; POST `.../{version}/restore?projectId=...` |
| Generation | POST `/api/generations`; POST `/api/generations/{session}/resume` and `/cancel` |
| SSE | GET `/api/generations/{session}/events`; revision scope adds `scope=revision&ref={id}` |
| Revision | GET/POST `/api/revisions`; GET `/api/revisions/{id}`; POST `.../accept` and `.../reject` |
| Generation logs | GET `/api/evaluation/logs` |

Generation reserves one log per session, serializes duplicate starts and creates
pending sections from the active template. A lost HTTP acknowledgment does not
fail a run already claimed by n8n. Resume gets a new run identity and event cursor,
so an earlier terminal event cannot end the new stream.

Fetch-based SSE carries `Last-Event-ID`, refreshes expired owner sessions, bounds
decoding, suppresses duplicate events and reconnects with backoff. The server
polls every 500 ms and sends 15-second heartbeats. Terminal workflow errors are
typed port errors, not endless reconnects. The watchdog runs every 15 seconds
and during stream reads: three minutes idle or fifteen minutes total by default.
Cancel persists before a best-effort n8n execution stop. Late runner results cannot
replace watchdog terminal decisions. Missing final execution bodies use checkpoint
resume instead of fabricated export recovery.

Section writes enforce versions and locks. Conflicts return the current owner
section, retain the editor draft, and show both texts. Saving a reviewed manual
draft requires another version check. Autosave serializes writes and retains
input typed while a previous write is pending. Revision accept is atomic and
rejects stale proposals without changing any other section.

The migration adds an optional requirements array to `accept_revision`, retaining
two-argument compatibility. The UI passes the shared parser's result so structured
requirements and Markdown commit together. Callbacks increment pending section
versions and preserve matching human/locked checkpoints. The manuscript renderer
now displays annotations after requirement metadata instead of silently omitting
them.

## Acceptance

```powershell
pnpm.cmd test:b6
pnpm.cmd test:b5
$env:NASKAH_E2E_MODE='live'
pnpm.cmd exec playwright test tests/e2e/live-workflows.spec.ts
```

The same lifecycle contract runs against mock and HTTP adapters. The HTTP matrix
checks actual services, an intentionally cut/reconnected stream, owner/origin
denial, conflicts, locks, history, readiness gating, duplicate dispatch, concurrent
and stale revisions, human-edited checkpoint resume, cancel, and watchdog handling
of late results. It refuses real provider settings, resets failure injection and
deletes only its own synthetic projects. Reports are ignored under `artifacts/`.

Live UI tests cover both themes: intake, generation, reload persistence, delayed
autosave while typing, conflicting tab edits, pending proposal reload, target-only
accept/reject, finalization and genuine DOCX output. Browser requests are checked
to exclude direct n8n/Supabase/provider access. Exact gate results are recorded in
`backend-phase-reports.md`.

## Boundaries and deviations

- `live` describes persistence/orchestration. Providers remain mock, and synthetic
  runs have `is_thesis_run=false`.
- Fetch-based SSE replaces EventSource for explicit session/cursor control.
- B7 server parsing/compilation and B8 research/evaluation remain pending. Existing
  browser PDF/TXT cleaning and DOCX/print helpers moved to `services/client` and
  work with persisted documents. Server parser/compiler stubs remain explicit.
- Only generation-log reads are connected for evaluation. Research imports,
  reviews, SUS, blind mapping and administrative reset are outside this change.
- Optional port methods preserve Phase 1 mock behavior. Sample loading creates
  draft projects rather than importing fixture-generated manuscripts as live data.
- Manual writes are blocked while generation is active to protect against an
  in-flight checkpoint overwriting human work; completed text remains visible.
- n8n save policies remain `none`, with the documented transient initial-row
  limitation. No secrets are included in workflow artifacts.

The installed Next route/instrumentation guides and n8n execution-stop controller
were inspected. Supabase's changelog confirmed CLI v3's local default; grants/RLS
guidance was consulted through MCP docs. No hosted project was modified.
