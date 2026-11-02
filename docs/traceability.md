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
