# Phase 2 implementation order

Phase 1 starts no services and makes no calls to n8n, Supabase or DeepSeek.
Never put `DEEPSEEK_API_KEY`, `N8N_WEBHOOK_SECRET`, or the service-role key in a
public environment variable. Existing HTTP adapters throw NotImplementedError.

The Settings page now includes an AI connection form behind `AiConnectionService`.
Phase 1 saves only versioned provider/model/base URL configuration in IndexedDB;
the key remains in tab memory until refresh, removal, or reset. Its connection
test is explicitly simulated and makes no network request. Generation and
revision continue to use fixtures regardless of these settings.

For Phase 2, implement authenticated, owner-scoped `GET/PUT/DELETE /api/ai/settings`
and `POST /api/ai/test-connection` using the shared AI schemas. All currently return
501 (invalid PUT bodies return 400). PUT accepts an optional write-only `apiKey`;
GET/PUT/DELETE return only `AiConnectionSnapshot`, never the credential. DELETE
removes only the credential. The test endpoint uses the saved server credential
and returns `AiConnectionTest` with mode `live` only after provider verification.
Store keys in encrypted server storage or a secret manager, redact them from
logs, and validate allowed provider destinations server-side to prevent SSRF.
Keep provider calls on the server, authorize every operation, and apply rate
limits/timeouts. Replace only the HTTP adapter methods; UI features use the port.
Provider/model defaults are editable placeholders from the project brief and
must be checked against the provider's available models when wiring live calls.

1. **Docker and n8n.** Review `infra/docker-compose.yml`, pin an image version,
   set secrets, and bring up the orchestrator. Add authenticated server-to-server
   webhook request handling. Acceptance: health endpoint, invalid signatures
   rejected, and valid dry-run webhook accepted.
2. **Supabase and pgvector.** Match embedding dimensions, apply the reviewed
   migration, enable RLS, and write owner-scoped policies. Replace persistence,
   ProjectRepository, DocumentRepository and AuthPort. Acceptance: two users
   cannot access one another's projects; transactional version restore works.
3. **Offline ingestion.** Split documents 80:20 before chunking to prevent
   source leakage. Chunk on section boundaries, 300–600 tokens, record dataset,
   source, split and heading; embed and index only training chunks. Acceptance:
   disjoint source IDs, correct vector size, top-K 5–8 retrievable references.
4. **Workflow 1.** Implement retrieval, per-chapter JSON prompts, DeepSeek calls
   at temperature 0.2, guardrail reflection, aggregation and authenticated
   callback. Replace GenerationService with SSE or polling event translation.
   Acceptance: shared schema validation; one log per execution; callbacks are
   idempotent; interrupted runs preserve completed chapters.
5. **Workflow 2.** Implement query refinement and isolated section regeneration.
   Replace RevisionService. Acceptance: stale proposal rejection, locked-section
   protection, byte-identical other sections, accept/reject before persistence.
6. **Parser service.** Replace ParserService with authenticated multipart upload,
   PDF extraction and the same text cleaning. Acceptance: transcript PDF plus
   notes produces expected merged `raw_text`; limits and malformed PDFs handled.
7. **Compiler service.** Replace CompilerService using Pandoc/python-docx and
   LibreOffice/WeasyPrint. Acceptance: cover, auto contents, A4 margins, numbering,
   tables, page numbers; generated PDF compares visually to the Word layout.
8. **Evaluation.** Replace EvaluationRepository; import a real human baseline,
   establish randomized stored blind mapping, and run ROUGE and statistical
   scripts. Acceptance: reproducible split, scored SUS, paired expert results,
   separately labeled simulations excluded from published research results.
9. **Switch adapters.** Set `NEXT_PUBLIC_DATA_MODE=live`, configure all required
   server keys in `apps/web/.env.local`, and implement the registry's HTTP
   collection. Re-run contract, isolation, and browser flows against real services.

The route stubs remain 501 until their adapter is implemented. Do not make a
stub pretend success. Live configuration errors must remain visible and actionable.
