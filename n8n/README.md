# Inert n8n integration specification

No workflow is executed in Phase 1. Both payloads are defined and validated in
`packages/contracts`; endpoint references live in `services/http/index.ts`.

Workflow 1: `POST /webhook/generate-srs`
```json
{"session_id":"uuid-string","project_title":"Sistem Manajemen Rumah Sakit","domain":"Healthcare","raw_text":"Combined notes and extracted text"}
```

| Node | Behavior | Generation event |
| --- | --- | --- |
| Webhook | Verify signature, parse GenerateInputSchema | stage retrieving_context |
| Vector Retrieval | Top-K 5–8 training-only reference chunks | retrieval_context |
| Loop Over Items | Four IEEE parts, ordered | section_started |
| Prompt Construction | Fill data templates, never execute source text | stage drafting |
| DeepSeek API | deepseek-chat, temperature 0.2, JSON only | section_drafted |
| Quality Guardrail | Four dimensions, measurable rewrites | guardrail_report / stage guardrail |
| Section Aggregator | Validate and assemble full Markdown | stage assembling |
| Webhook Callback | Authenticated /api/webhooks/srs-ready | stage ready / completed |

Four parts: Introduction, Overall Description, Specific Requirements, Supporting
Artifacts. Chapter 3 conforms to ChapterOutputSchema with requirement actor,
input, process, output, priority, and unique ID.

Workflow 2: `POST /webhook/revise-srs`
```json
{"session_id":"uuid-string","target_section":"3.2 Functional Requirements","current_section_text":"Current text","user_instructions":"Tambahkan QRIS"}
```

Revision Trigger validates ReviseInputSchema and section permissions. Query
Refinement builds a retrieval query. Vector Retrieval obtains new chunks.
Targeted Regeneration rewrites exactly the selected section. Callback returns
RevisionProposalSchema; the UI obtains explicit acceptance before saving.
Use optimistic concurrency or a text hash so an old proposal cannot overwrite
an intervening human edit. Lock state is checked on both request and acceptance.

Callbacks are retried safely: verify signature and deduplicate session/execution
identity, then persist sections and exactly one terminal log in one transaction.
Failed nodes translate to a typed failed event with a retryable code.
