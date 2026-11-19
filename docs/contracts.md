# Kontrak final backend lokal

Checkpoint B10, 11 November 2026. Source of truth:
[`index.ts`](../packages/contracts/src/index.ts),
[`backend.ts`](../packages/contracts/src/backend.ts), dan
[`ai-connection.ts`](../packages/contracts/src/ai-connection.ts).
Zod memvalidasi boundary; HTTP adapters sudah berfungsi, bukan lagi placeholder
Phase 1. Schema lama tetap dipertahankan untuk kompatibilitas adapter mock.

## Boundary, auth dan error

UI mengakses typed service ports melalui registry `NEXT_PUBLIC_DATA_MODE`.
`mock` memilih IndexedDB/helper browser; `live` memilih HTTP same-origin ke
Next.js. Live bukan sinonim provider berbayar: checkpoint memakai mock lokal.

`GET /api/auth/session` dengan `X-Naskah-Client: web` menerbitkan signed HttpOnly
cookie local-owner 12 jam. Route owner memeriksa host loopback, port, origin,
owner dan kedaluwarsa; mutation memerlukan same origin atau header client lokal
sesuai implementasi. Ini bukan akun Auth publik. Service-role/DB/provider key
hanya server-side. Endpoint callback terpisah memakai bearer, freshness dan
identitas run. Webhook production n8n memakai `X-Naskah-Token`.

Error normal: `{code, retryable, userMessageKey, detail?}`; detail hanya konteks
konflik aman milik owner. Invalid schema 400, content type 415, batas payload 413,
unauthorized/forbidden 401/403, konflik versi/scope 409, dependency failure sesuai
kode. JSON owner response tidak di-cache. Jangan menganggap semua object schema
strict: field tambahan hanya ditolak oleh schema yang menggunakan `.strict()`.

## Entitas dan mutation HTTP

| Kontrak | Route / perilaku |
| --- | --- |
| `ProjectSchema`, `ProjectCreateSchema`, `ProjectPatchSchema` | `/api/projects`, `/api/projects/{id}`; owner ditentukan server, title/domain/rawText/language/template disaring |
| `DocumentSchema`, `DocumentWriteSchema` | `/api/documents/{id}`; project, metadata, template, sections dan retrieved chunks |
| `SectionSchema`, `SectionWriteSchema` | `/api/sections/{id}`; ID bagian berupa teks, project context wajib; `If-Match` untuk versi |
| `VersionSchema`, `SectionVersionSchema` | Version/list/restore di `/api/documents/{id}/versions` dan `/api/sections/{id}/versions`; restore membuat versi baru |
| `RequirementSchema` | ID `REQ-[A-Z]-digits`, title/description/actor/input/process/output/priority; unik lintas dokumen |
| `GuardrailSchema`, `RewriteSchema` | Empat verdict, proposal rewrite dengan `needs_confirmation`; angka baru tetap memerlukan review manusia |
| `RetrievedChunkSchema` | Sumber/dataset/excerpt/similarity, model/dimensi/provenance/dev_seed; tidak memuat key |

Section write memeriksa owner, lock dan versi secara transaksional. Konflik
`section_changed` membawa `detail.current` untuk review eksplisit. Lock/stale
tidak diatasi dengan retry overwrite otomatis. Riwayat immutable; target revision
tidak boleh mengubah bagian lain atau menggandakan requirement ID.

## Generate, SSE dan Revise

Public app route `POST /api/generations` memakai `GenerationRequestSchema`;
gateway memanggil `POST /webhook/generate-srs` terautentikasi. Field awal tetap:

```json
{
  "session_id": "e73b9f22-1648-4619-a410-000000000011",
  "project_title": "Sistem Manajemen Rumah Sakit",
  "domain": "Healthcare",
  "raw_text": "Catatan kebutuhan gabungan"
}
```

Amendment opsional: run ID, output language, template, options (K/model/temperature)
dan resume state. Server menetapkan konteks/owner/run yang sah; payload tidak
boleh mengirim provider key. `GenerationAcceptedSchema` berisi accepted,
session/run/project ID, after_seq dan nullable execution ID. HTTP menerima job,
bukan menunggu seluruh naskah jadi. Run cancel/resume di
`/api/generations/{id}/cancel|resume` memeriksa checkpoint dan terminal state.

`GET /api/generations/{session_id}/events` membawa `WorkflowEventSchema` melalui SSE:
monotonic `id`, JSON `data`, heartbeat, replay cursor. Event stage/retrieval,
section_started/drafted, guardrail_report, completed/failed/cancelled tersedia;
revision memakai revision_ready. Persistensi checkpoint/event mendahului replay;
reconnect tidak memulai job baru. Revision menggunakan route SSE yang sama dengan
`?scope=revision&ref={revision_id}`. Cursor dikirim sebagai `Last-Event-ID` atau
query `after`. Detail: [B6](B6-local-ui.md).

`POST /api/revisions` memakai `RevisionRequestSchema`; webhook
`POST /webhook/revise-srs` mempertahankan field berikut:

```json
{
  "session_id": "e73b9f22-1648-4619-a410-000000000011",
  "target_section": "3.2 Functional Requirements",
  "current_section_text": "Bagian saat ini",
  "user_instructions": "Tambahkan dukungan QRIS"
}
```

Amendment: revision ID, base section version, output language. Callback menyimpan
proposal pending; `POST /api/revisions/{id}/accept|reject` keputusan terpisah.
Accept mengecek ulang versi/lock/ID; reject mempertahankan teks. Pending proposal
dapat dibaca ulang setelah reload. Mode mock mengimplementasikan port yang sama.

`WorkflowReadyCallbackSchema`, `WorkflowRevisionCallbackSchema` dan failure
schema memuat event_id, session_id, sent_at dan optional run_id; callback sukses
juga memuat execution_id. Sequence SSE diberikan saat event dipersistensi. Route
`/api/webhooks/srs-ready|srs-revision-ready|srs-failed` melakukan autentikasi,
freshness dan deduplikasi sebelum transaksi event/checkpoint/final. Callback
berulang tidak menggandakan terminal log. Provider output harus lolos
`ChapterDraftSchema` sebelum [render Markdown bersama](markdown-contract.md).

## Settings dan readiness

Live memakai `Services.integrations`, bukan penyimpanan key browser Phase 1.
`IntegrationIdSchema` terbatas `n8n|deepseek|embeddings`.

| Route | Kontrak |
| --- | --- |
| `/api/settings/integrations/{id}` | GET/PUT/DELETE config/key; `IntegrationSaveSchema.apiKey` write-only |
| `/api/settings/integrations/{id}/test` | POST smoke nyata melalui n8n; provider checkpoint ini mock |
| `/api/settings/integrations/reapply` | POST sinkron internal credential, binding, publish dan smoke |
| `/api/system/status` | GET `SystemStatusSchema`: reasons, links Settings, workflow dan knowledge readiness |

Safe DTO `IntegrationStateSchema`: config, last-four hint, stored/synced/tested,
step/error code/timestamps; tidak mengembalikan secret. Base URL berubah memerlukan
key baru. Key disimpan AES-256-GCM dengan associated data provider+owner dan
key_version. Doctor startup/periodik mendeteksi drift; ambiguous name/type diblokir.
Update credential mencoba metode terdukung, memperbaiki binding yatim hanya pada
workflow Naskah. Detail recovery/rotasi: [runbook](runbook.md).

Legacy `/api/ai/settings` dan `/api/ai/test-connection` tetap placeholder 501
(invalid input settings 400); UI Settings live menggunakan integrasi baru di
atas. Jangan memakai API legacy untuk provisioning backend baru.

## Parser dan compiler

`POST /api/parse-pdf` memakai **multipart file** untuk PDF/TXT; nama route tidak
membatasi input hanya PDF. `ParseInputSchema` JSON lama bukan transport upload
live. `ParsedDocumentSchema`: name, text, pages, before/after/removed dan size.
Ekstraksi dan shared cleaning server dipakai intake; OCR tidak tersedia.

`POST /api/compile-document` memakai `CompileInputSchema` (documentId, format
docx/pdf, author/institution literal opsional). Server menggunakan snapshot
tersimpan; `CompileResultSchema` adalah `{mode:'server',url,filename,size,format}`
atau pilihan eksplisit `{mode:'client'}`. Tidak ada fallback diam-diam saat gagal.
`GET /api/exports/{id}` mengotorisasi owner, membuat signature Storage privat
60 detik di server dan mengirim berkas; URL key Storage tidak dikembalikan ke UI.
Limit, cache, sanitasi dan QA: [B7](B7-documents.md).

## Evaluasi

Seluruh `/api/evaluation/{resource}` owner-scoped; query `scope` default **dev**.
Perhatikan CLI exporter default research: selalu tulis `--scope` secara eksplisit.

| Resource | Method dan schema |
| --- | --- |
| `context` | GET/POST; `EvaluationConsentSchema`, cookie peserta per scope, `EvaluationContextSchema` |
| `cases` / `blind` / `mapping` | GET/POST cases: `EvaluationCaseInputSchema`; GET snapshot A/B, mapping setelah review lengkap |
| `seed` | POST fixture hanya dev; research ditolak |
| `reviews` | GET/POST `EvaluationReviewInputSchema`: assignment, empat rating 1–5, alasan/comments; immutable |
| `sus` | GET/POST `EvaluationSusInputSchema`: sepuluh integer 1–5; server/DB menghitung, skor kiriman klien diabaikan |
| `overview` / `logs` | GET ringkasan scoped/desain dan log generation |
| `rouge` (arsip) | GET/POST `EvaluationComputeSchema` → `RougeReportSchema` dengan bahasa/valid_comparison/provenance |
| `statistics` | GET/POST `EvaluationStatisticsInputSchema` → `StatisticsReportSchema` (desain, seed, unit peserta, Holm, effect/CI/provenance) |
| `import` | POST report terverifikasi; dihitung ulang terhadap input owned, bukan percaya angka file |
| `export` | GET JSON `EvaluationExportSchema` atau CSV dataset; pseudonim, tanpa free text/key/naskah |

Case snapshot, design dan review/SUS yang terkirim immutable. Satu SUS per peserta;
retry identik idempoten. Research membutuhkan completed thesis run tanpa mock/
dev_seed; enrollment masih belum menjadi UI. `legacy-import` hanya compatibility
dev/unverified. Seluruh detail limit/metode: [B8](B8-evaluation.md),
[panduan data skripsi](thesis-data-guide.md).

## Bukti kontrak

Unit/shared goldens memverifikasi schema, Markdown, SUS, auth/redaction dan port
conformance. B5 menguji webhook/callback aktual, B6 HTTP/SSE/konflik, B7 upload/
compile/download, B8 scope/immutability/analisis/impor/ekspor, B9 alur yang sama
dari browser. [Traceability](traceability.md) memetakan setiap FR ke file tes.
Semua acceptance lokal memakai mock; tidak membuktikan API atau mutu data nyata.
