# B5: local SRS workflows

Implemented and tested on 10 November 2026 (Asia/Jakarta), with local n8n 2.46.6,
matching external runners, Supabase CLI 3.0.0, and the deterministic provider on
port 4010. The 150-chunk development corpus is synthetic and is not research
evidence. The browser remains in mock mode; full application HTTP adapters are B6.

## Workflows and source

| Workflow | Trigger | Nodes | Behavior |
| --- | --- | --- | --- |
| Naskah / Generate SRS | POST `/webhook/generate-srs` | 14 | Validate and acknowledge, condense long input, retrieve global/chapter evidence, draft and repair JSON, reflect, checkpoint, render, callback |
| Naskah / Revise Section | POST `/webhook/revise-srs` | 14 | Refine up to three queries, retrieve, revise only the target, preserve IDs/headings, run a guardrail, return a pending proposal |
| Naskah / Error Handler | Error Trigger | 10 | Recover safe parent execution metadata, persist a stable failure, deliver an authenticated failure callback |
| Naskah / Smoke / Supabase | POST `/webhook/naskah-smoke-supabase` | 15 | Check service credential and vector RPC without returning document content |

`n8n/src/workflow-builder.ts` produces the JSON and SDK artifacts. The pure planner
in `workflow-runtime.ts` owns stage transitions; `workflow-domain.ts` owns bounded
queries, validation, safe rewrites and backoff. Shared rendering and parsing live
in `packages/core`. The chapter JSON Schema is generated from the Zod contract.
The active template and prompt versions are database data.

All network calls are explicit credential-bound HTTP Request nodes. Provider and
database calls permit three total attempts, with exponential backoff and
`Retry-After`. Callbacks permit five total attempts. A requested wait over five
minutes fails rather than retrying earlier than requested. Default LLM timeout is
60 seconds; acceptance tests temporarily lower it for timeout injection.

The generation planner processes one chapter at a time and writes completed
sections to Postgres after each chapter. Resume trusts that database checkpoint,
not a supplied completed-sections body. A final-callback-only resume skips all
drafting. Cancellation is checked between parts and after progress writes.

Revision context contains the target text and reserved requirement identifiers;
it contains no other section text or full transcript. The callback stores a
pending proposal. Only the existing atomic `accept_revision` transaction changes
the target section, with lock and version checks.

## Build, deploy, recover and test

Run from the repository root, with the local services and app running:

```powershell
pnpm.cmd n8n:build
pnpm.cmd n8n:deploy
pnpm.cmd test:b5
```

Deployment reads the prebuilt artifacts and the encrypted n8n Settings connection.
It substitutes non-secret URL/owner placeholders, resolves unique credential
names/types, upserts by workflow name, sets parent error routing, activates, and
reads the result back. Repeated deployment preserves workflow/node IDs, positions,
group IDs and existing MCP visibility. Settings **Terapkan ulang** uses this same
server function after successful provider smokes. Startup recovery does not call
paid providers. CLI setup and tests use only generated dummy provider keys.

Required credentials are `naskah/webhook-inbound`, `naskah/deepseek`,
`naskah/embeddings`, `naskah/callback-bearer`, and `naskah/supabase-rest`.
No credential IDs or values are embedded in Git artifacts. The three new main
workflows are not enabled for MCP. Existing transfer workflows are preserved.

`test:b5` refuses a nonlocal provider or a non-test key, uses real authenticated
n8n production webhooks and local Supabase, then resets failure injection and
restores generation configuration. Its temporary foreign-owner corpus rows and
credentials are removed. Remaining projects are labeled `B5 synthetic`, have
`is_thesis_run=false`, and may be inspected locally. Reports under `artifacts/`
are ignored by Git and contain no request bodies or credentials.

## Acceptance

All 26 matrix cases passed. The matrix covers deployment recovery; Supabase smoke; all four generation parts;
byte-identical shared rendering; valid JSONB persistence; target-only revision and
atomic acceptance; concurrent proposals; invalid input/auth; one JSON repair;
persistent invalid-schema and empty replies; 401; 429 with Retry-After; 500;
timeout/huge latency; invalid guardrail replies; transient retry recovery; embedding
dimension/model errors; assumptions and ID protection; long-input map/reduce;
cancellation before/during a run; refinement fallback; empty knowledge base;
foreign-owner retrieval exclusion; invalid revision IDs; five failed callback
attempts followed by checkpoint resume; and replay/conflict/stale callbacks.

The test checks API execution metadata with `includeData=false` while runs are
active. Failure assertions require the event written by the actual Error Trigger,
retained checkpoints, and a failure callback receipt. Completed generation checks
15 sections, token/structure metrics, retrieval audit rows and the SHA-256 of the
exact callback Markdown. Revisions leave every other section byte/version equal.
The ignored `artifacts/b5-acceptance.json` records individual outcomes and safe
execution metadata; the phase report records the final gate results.

The stable failure vocabulary includes `config_missing`, `integration_not_ready`,
`embedding_dimension_mismatch`, `embedding_model_mismatch`, `knowledge_base_empty`,
`retrieval_failed`, `llm_unauthorized`, `llm_rate_limited`, `llm_timeout`,
`llm_invalid_output`, `guardrail_failed`, `callback_failed`, `cancelled`, and
`unknown`. Existing lock/version errors are also retained. Failed callbacks set a
database flag and preserve completed sections for resume.

## Deliberate deviations and remaining boundaries

- A single-item stage loop replaces a dedicated Loop Over Items node. It keeps
  retries and resume on the same durable checkpoint and prevents item multiplication.
  The bundled planner Code node is consequently larger than the brief's small-node
  convention; pure helpers, restricted-runner tests, source modules and explicit
  HTTP boundaries keep it reviewable.
- Reflection's corrected chapter object is never trusted wholesale. Only unique
  literal rewrites are applied, then schema/IDs are validated again. Unsupported
  numeric targets are marked for confirmation even if the model clears the flag.
- Minimal real callback routes were implemented during B5 to test delivery and
  transactions. B6 still owns full routes, adapters, SSE/watchdog and port conformance.
- Execution save-data policies are `none`. n8n can transiently write initial
  execution data before pruning; these policies are not a guarantee against
  temporary authorization-header persistence. Final body exports are deliberately
  unavailable. Checkpoints, progress events and receipts supply durable evidence.
- W3 carries only a sanitized code/stage/session/run/revision/execution marker,
  not provider error bodies or user documents. This also permits recovery when
  n8n omits a saved parent execution body.
- The migration extends the vector RPC with an optional owner filter. Workflows
  always supply the trusted owner; the old five-argument service call still works.
  Runtime RPCs use invoker rights, an empty search path and service-role-only grants.
- Live MCP validation accepts all four artifacts. Its generic-auth warnings arise
  from SDK credential-name placeholders; deployment binds the existing generic
  HTTP credentials required by this project.

Rollback starts from the consistent pre-B5 n8n backup
`%LOCALAPPDATA%\n8n-backups\20261109-210943-bdf69a` and the helper/runbook outside
Git. Preserve the encryption key, volume, and SQLite WAL files. Never use
`docker compose down -v` or prune the local volumes. A database schema rollback
requires its own backup; the n8n backup does not contain Supabase.

API references checked against the installed instance and official documentation:
[n8n error handling](https://docs.n8n.io/flow-logic/error-handling/),
[Supabase database functions](https://supabase.com/docs/guides/database/functions).
