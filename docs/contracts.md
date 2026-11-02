# Shared contracts

Source of truth: `packages/contracts/src/index.ts`. Schemas infer all TypeScript
entities. Unknown/invalid inputs return 400 at API boundaries; valid requests
reach deliberate 501 placeholders in Phase 1.

AI connection schemas live in `packages/contracts/src/ai-connection.ts` and are
re-exported from the package entry. `AiConnectionConfigSchema` validates provider,
model and HTTPS base URL; `AiConnectionSaveSchema` adds an optional write-only key.
`AiConnectionSnapshotSchema` exposes configuration, `hasApiKey`, and credential
storage (`memory` or `server`), never the key. `AiConnectionTestSchema` distinguishes
mock/simulated results from live/connected results. Generation and revision
payloads remain unchanged: credentials are resolved behind the service boundary.

| Schema                 | Fields / role                                                                                                |
| ---------------------- | ------------------------------------------------------------------------------------------------------------ |
| ProjectSchema          | UUID, ownerId, title, domain, version, status, dates, sessionId, rawText                                     |
| RequirementSchema      | REQ identifier, title, description, actor, input, process, output, priority                                  |
| RewriteSchema          | ID, original, rewritten, reason, resolved                                                                    |
| GuardrailSchema        | Four dimension verdicts and rewrite list                                                                     |
| SectionSchema          | Number, title, Markdown, status, source, requirements, guardrail, date                                       |
| RetrievedChunkSchema   | Dataset, similarity in [0,1], excerpt                                                                        |
| DocumentSchema         | Project, template, sections, metadata, retrieval chunks                                                      |
| VersionSchema          | Immutable section snapshot, label, date                                                                      |
| GenerationLogSchema    | Session, project title, domain, terminal status, duration, completeness                                      |
| GenerateInputSchema    | Workflow 1 request below                                                                                     |
| ReviseInputSchema      | Workflow 2 request below                                                                                     |
| RevisionProposalSchema | Target, instruction, before, after, refined query, pending/accepted/rejected                                 |
| ChapterOutputSchema    | section_title, external_interfaces, functional_requirements, performance_requirements, security_requirements |
| ReadyCallbackSchema    | session_id, markdown, validated document                                                                     |
| ParseInputSchema       | filename, content; Phase 2 transport placeholder                                                             |
| CompileInputSchema     | documentId, docx/pdf format                                                                                  |
| ExpertReviewSchema     | Pseudonym, A/B label, four ratings and rationales, comments                                                  |
| SusResponseSchema      | Ten integer responses 1–5, computed score, comment                                                           |
| RougeSchema            | Scenario, ROUGE-1/2/L precision, recall, F1                                                                  |
| TemplateSchema         | Standard identifier, chapters, required subsections, prompt references                                       |

`POST /webhook/generate-srs`

```json
{
  "session_id": "e73b9f22-1648-4619-a410-000000000011",
  "project_title": "Sistem Manajemen Rumah Sakit",
  "domain": "Healthcare",
  "raw_text": "Catatan kebutuhan gabungan"
}
```

`POST /webhook/revise-srs`

```json
{
  "session_id": "e73b9f22-1648-4619-a410-000000000011",
  "target_section": "3.2 Functional Requirements",
  "current_section_text": "Bagian saat ini",
  "user_instructions": "Tambahkan dukungan QRIS"
}
```

Callbacks may be retried. Phase 2 must authenticate the webhook and deduplicate
session/execution delivery before writes. Port failures include a stable code,
retryable flag, and localization key. No transport-specific data leaks into UI.
