# Traceability fungsional final B10

11 November 2026. Ini peta implementasi **saat ini**, menggantikan kolom rencana
Phase 1. Bukti berikut memakai layanan lokal dan provider mock; bukan hasil studi.
Semua path test relatif root repo. Detail chain terhubung: [B9](B9-end-to-end.md).

| ID | Route UI / API | Backend/workflow | Bukti pengujian |
| --- | --- | --- | --- |
| FR-IN-01 — teks | `/new-project`, `/api/projects`, `/api/generations` | Supabase project, **Generate SRS**, callback + SSE | `tests/e2e/live-system.spec.ts` alur text/reconnect/resume; `scripts/test-b5.ts`, `scripts/test-b6.ts` |
| FR-IN-02 — PDF/TXT | `/new-project`, `POST /api/parse-pdf` | Parser server multipart; merged notes | `tests/e2e/server-parser.spec.ts`, `tests/e2e/live-system.spec.ts`; `scripts/test-b7.mjs` PDF/TXT/encoding/limit |
| FR-IN-03 — ekstrak/bersih | Intake preview, `/api/parse-pdf` | PDF child worker, shared cleanPages, duplicate header/footer cleaning | `tests/domain.test.ts`, `tests/e2e/server-parser.spec.ts`; B7 parity, encrypted/scanned/200-call soak |
| FR-HITL-01 — edit manual | `/workspace/[id]`, `/api/sections/{id}`, versions/restore | Supabase transaksi section/history; tanpa panggilan LLM | `tests/e2e/live-workflows.spec.ts` autosave/conflict; `tests/e2e/live-system.spec.ts`; `scripts/test-b6.ts` |
| FR-HITL-02 — revisi instruksi | `/workspace/[id]`, `/api/revisions` | **Revise Section**, query refinement/retrieval/proposal callback | `scripts/test-b5.ts`, `scripts/test-b6.ts`; `tests/e2e/live-system.spec.ts` accept/reject |
| FR-HITL-03 — isolasi target | Section/proposal API, `/api/revisions/{id}/accept` | Lock/version/ID guards, transaksi target-only | B5/B6 other-section byte identity, locked/stale/concurrent proposal; `tests/port-conformance.test.ts`, `tests/markdown-contract.test.ts` |
| FR-HITL-04 — diff/accept/reject | Revision diff, `/api/revisions/{id}/accept|reject` | Pending proposal tersimpan, version history; reject tidak mengganti teks | `tests/e2e/live-workflows.spec.ts` reload pending; `tests/e2e/live-system.spec.ts`; `scripts/test-b6.ts` |
| FR-EXP-01 — susun template | `/export/[id]`, `/api/compile-document` | Compiler Pandoc + IEEE830 DOCX template + LibreOffice TOC | `scripts/test-b7.mjs`, `scripts/verify-b7-documents.py` OOXML/layout; all-page QA B7; `tests/e2e/live-system.spec.ts` |
| FR-EXP-02 — unduh DOCX/PDF | `/export/[id]`, `/api/exports/{id}` | Compiler, Supabase Storage privat, authorized download | B7 ZIP/XML/PDF/cache/auth; `tests/e2e/live-system.spec.ts`; `scripts/test-compiler-lifecycle.mjs` 30 compile, nol zombie |
| Settings / integrasi | `/settings`, `/api/settings/integrations/*`, `/api/system/status` | Registry, AES envelope, credential sync/rebind, empat smoke; **Error Handler** untuk job gagal | `tests/e2e/live-settings.spec.ts` create/rotate/delete/full recovery/key hash; `scripts/test-integrations.ts`; security unit + secret scans |
| RQ1 — otomasi/struktur | `/evaluation`, logs/overview API | `srs_generation_logs`, retrieval logs, core/Python structure | B5/B6 callbacks/log dedupe; `scripts/test-b8.mjs`; `tests/evaluation-golden.test.ts` |
| RQ2 — ahli/statistik | `/evaluation`, cases/blind/reviews/rouge/statistics/export API | Frozen snapshots, separate source maps, evaluator Python | `tests/e2e/live-evaluation.spec.ts`, `tests/e2e/live-system.spec.ts`; `scripts/test-b8.mjs`, `pnpm test:python` numerical/reference |
| RQ3 — SUS | `/evaluation?tab=sus`, context/sus/export API | Consent, participant cookie, TS/server/DB SUS recompute | `tests/evaluation-golden.test.ts`, `pnpm test:python`; B8 HTTP scope/idempotency, live evaluation reload |

`tests/e2e/flows.spec.ts` dan `ai-settings.spec.ts` mempertahankan original browser
mock acceptance, terpisah dari live counterparts. Test B9 memilih live suite
dan menolak konfigurasi provider nyata; mock suite dijalankan setelah server
diganti ke mode mock. Jangan mengartikan skipped mock cases di live suite sebagai
uji backend yang tidak dilakukan. Lihat [runbook](runbook.md).

## Cross-cutting dan batas bukti

| Aspek | Bukti | Batas |
| --- | --- | --- |
| Kontrak/parity | `tests/port-conformance.test.ts`, `markdown-contract.test.ts`, `n8n-markdown.test.ts`, `http-stream.test.ts` | Pure renderer/ports + replay; bukan mutu LLM |
| Auth/secret | `backend-security.test.ts`, `backend-auth-stream.test.ts`, `backend-integrations.test.ts`, `workflow-callbacks.test.ts`; B9 scans | Local-owner, bukan portal publik |
| RLS/integritas | `scripts/test-database.mjs`, advisor lokal B9 | 29 tabel, anon GET/POST ditolak; tiga warning SQL lint B5 existing tetap tercatat |
| Penelitian | B8 scope/provenance/import guards dan Python research rejection | Tidak ada studi nyata/enrollment UI; research checkpoint kosong |
| Operasi | B9 Windows startup/doctor/credential recovery, B10 verifikasi docs | Full volume restore, rotasi encryption key dan instalasi Windows kosong belum didrill |

Hasil gate tercatat dalam [laporan backend](backend-phase-reports.md) dan
[laporan B10](B10-handoff.md). Reproduksi tabel evaluasi:
[panduan data skripsi](thesis-data-guide.md).
