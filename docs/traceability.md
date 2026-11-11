# Functional traceability

| Requirement | UI route / implementation                              | Port                                 | Verification                                                                                | Phase 2                                                   |
| ----------- | ------------------------------------------------------ | ------------------------------------ | ------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| FR-IN-01    | /new-project, features/intake                          | ProjectRepository, GenerationService | Text-only browser flow                                                                      | Workflow 1 webhook                                        |
| FR-IN-02    | File picker and drop zone, features/intake             | ParserService                        | PDF + notes browser flow                                                                    | Upload / parse endpoint                                   |
| FR-IN-03    | entities/document/cleaning.ts, services/mock/parser.ts | ParserService                        | Cleaning unit tests, extraction browser flow                                                | pdf-parse or Python parser                                |
| FR-HITL-01  | /workspace/[id], manuscript-editor.tsx                 | DocumentRepository                   | Autosave browser flow                                                                       | Transactional section save                                |
| FR-HITL-02  | Workspace revision dialog                              | RevisionService                      | 2FA / QRIS proposal tests                                                                   | Workflow 2 webhook                                        |
| FR-HITL-03  | entities/revision/apply.ts, repository locks           | RevisionService, DocumentRepository  | Byte identity, lock, stale proposal tests                                                   | Isolated regeneration                                     |
| FR-HITL-04  | features/revision, word diff viewer                    | DocumentRepository                   | Accept / reject browser flow                                                                | Same proposal contract                                    |
| FR-EXP-01   | /export/[id], services/mock/compiler.ts                | CompilerService                      | Real DOCX ZIP/XML validation                                                                | Server document compiler                                  |
| FR-EXP-02   | Word download, /export/[id]/print                      | CompilerService                      | Browser download and print route                                                            | DOCX + PDF service                                        |
| AI settings | /settings, features/settings/ai-connection.tsx         | AiConnectionService                  | Validation, session credential isolation, simulated test, reset and responsive browser flow | Authenticated server credential storage and provider test |

RQ1: /evaluation summary, real logs from simulated executions; RQ2: blind expert
form with rationales and descriptive statistics; RQ3: ten-item SUS with tested
scorer. Sample results are demonstration data, not research findings.

B5 (2026-11-10): FR-IN-01 now has a real authenticated Generate SRS workflow;
FR-HITL-02/03/04 have target-only revision, a pending callback proposal and atomic
acceptance with version/lock protection. `scripts/test-b5.ts` verifies actual local
n8n/Supabase execution, other-section byte identity, concurrent proposals, failure
events, resume/cancel and callback idempotency. Shared Markdown golden/runner tests
and `tests/b5-workflows.test.ts` verify schema, IDs, numeric guardrails and rendering.
These backend checks use synthetic inputs and mock provider responses. Existing
browser ports stay mocked until B6; they do not imply live UI integration or
research validation. See `B5-workflows.md` and `backend-phase-reports.md`.

B6 (2026-11-10): FR-IN-01 and FR-HITL-01/02/03/04 now run through authenticated
HTTP adapters with real local n8n/Supabase. Shared mock/HTTP port conformance,
SSE reconnect, owner/version/lock checks, human-edited checkpoint resume, and
both-theme live UI acceptance cover the integration. Manual drafts survive slow
autosave and explicit conflict review; pending revisions survive reload. Client
DOCX export uses the persisted document. Server parsing/compilation and research
evaluation remain B7/B8. Providers and acceptance data remain synthetic mock;
these tests are not thesis findings. See `B6-local-ui.md`.

## B7 document counterpart

FR-IN-03 maps to POST /api/parse-pdf and shared cleanPages, with synthetic
multipage/scanned/encrypted/limit fixtures, browser/server parity and a 200-call
measured soak. Export maps to POST /api/compile-document, the local Docker service
and authenticated GET /api/exports/{uuid}. Hospital OOXML/PDF assertions, all-page
raster review, private download/cache checks and both-theme live UI tests cover
DOCX/PDF output. Mock helpers remain selectable. See B7-documents.md.

## B8 evaluation counterpart — 2026-11-11

RQ1 uses owner/scoped logs and summaries, RQ2 uses frozen case snapshots,
participant-bound random blind assignments and immutable four-dimension reviews,
and RQ3 uses consented SUS answers with core/server/database recomputation.
The ResearchService HTTP port connects the UI to local Supabase and Python.
Shared SUS/heading goldens, numerical/reference tests, HTTP isolation/import/
export checks and both-theme live flows cover the implementation. Research scope
excludes mock/dev_seed runs; all executed acceptance is synthetic. Participant
means avoid pseudoreplication, with explicit paired/independent analysis design.
See B8-evaluation.md for limits, assumptions and CLI reproduction.

## B9 connected acceptance — 2026-11-11

The same persisted project now travels from text or PDF/TXT intake through
generation/reconnect/recovery, manual edit, accepted/rejected revision, DOCX/PDF
and consented evaluation. Live Settings proves the actual provider key hash after
create, rotation and full credential recovery. Both themes and all four evaluation
tabs at phone width are covered. The complete FR/route/workflow/test mapping is
in [B9-end-to-end.md](B9-end-to-end.md); user-triggered real-provider steps are in
[runbook.md](runbook.md). These are mock acceptance results, not thesis findings.
