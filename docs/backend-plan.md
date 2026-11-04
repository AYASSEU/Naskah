# Phase 2 implementation ledger

Started 2026-11-05. Source: `naskah_backend_phase2.md`. Phase 1 remains the UI/design authority. Phase 2 explicitly authorizes local Supabase, Docker and n8n work.

## Observed environment (B0)

- Next 16.4.2, React 19.3.1, strict TypeScript; features depend on ports. HTTP adapters and five routes currently return 501.
- Baseline: typecheck, lint, 29 unit tests, build, design audit, and 26 contrast pairs pass.
- n8n 2.45.7 on localhost:5678 with external runners; existing personal project and one manual Hello World test. No credentials before this work.
- n8n MCP responds; node catalog exposes Webhook 2.2, HTTP Request 4.5, Code 2, Loop Over Items 3, Respond to Webhook 1.5, Error Trigger 1.
- Public API responds 401 without authentication and 200 with the locally supplied API key. Live credential schemas: httpHeaderAuth uses name/value; httpCustomAuth uses a JSON string in json. Installed public controller supports PATCH /credentials/:id, not PUT updates. A disposable credential probe will verify write capability before sync.
- Supabase MCP is a hosted-account connector, not a local connection. It lists only an unrelated inactive project. No local Supabase containers or listener on 54321 existed. Use CLI 3.0.0 to create an isolated local stack; do not modify the hosted project.
- Existing n8n data is in n8n_local_data. Preserve its encryption key and existing workflows. Do not start a second server on 5678 or replace the volume.
- The app's Next route/security guides were read before server implementation.

## Gates and sequence

Each stage records exact verification in `docs/backend-phase-reports.md`. Do not describe unexecuted acceptance tests as passing.

| Stage | Deliverable | Acceptance |
|---|---|---|
| B0 | Inventory, decisions, research notes | baseline gates; verified service/API probes |
| B1 | Local Supabase, migrations, seed, generated types | RLS, leakage, locking, version isolation, advisors |
| B2 | Server environment, encryption, guards, errors, SSE | shared Node/Python crypto vectors; security unit tests |
| B3 | Settings integration registry and n8n sync | credential lifecycle and authenticated smoke webhooks |
| B4 | Corpus ingestion and development seed | disjoint splits, dimension/model consistency, retrieval |
| B5 | Versioned workflows and deterministic provider | real webhook executions, repair/failure/resume/cancel |
| B6 | Routes and HTTP ports | conformance, callback replay, SSE reconnect, revision isolation |
| B7 | Parser and document compiler | parser soak; DOCX properties; rendered PDF/TOC inspection |
| B8 | Research persistence and Python evaluation | shared scoring vectors, blinded sources, dev-data exclusion |
| B9 | Live UI acceptance | real DB/n8n + mock provider; both themes; secrets scan |
| B10 | Runbooks, traceability, thesis guide | instructions match observed results |

## Boundaries

Browser calls only same-origin APIs. Service credentials and encryption stay server-side. n8n HTTP nodes use credential references; no secrets in workflow parameters. Provider keys for automated tests are generated dummy values used only with the local mock provider. No paid provider calls are made by tests. Database changes are migration-based. Local-only ownership must reject nonlocal deployment until authenticated sessions are configured.

## MCP capability inventory

The complete tool-name inventory is in `backend-mcp-tools.json`, captured before implementation. Supabase provides hosted SQL, migrations, table/extension lists, advisors, type generation and documentation search; local operations require CLI fallback. n8n provides discovery, workflow validation/creation/update/publication/execution and execution inspection, but no credential creation tool: use the authenticated public API with live credential schemas.
