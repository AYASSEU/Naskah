# Workflow lokal Naskah

Checkpoint B10: workflow **aktif dan diuji** pada n8n lokal 2.46.6, backend
Supabase dan provider mock. Direktori ini bukan lagi scaffold inert Phase 1.

| Workflow | Tugas |
| --- | --- |
| Naskah / Generate SRS | `/webhook/generate-srs`: retrieval, drafting, guardrail, checkpoint dan final callback |
| Naskah / Revise Section | `/webhook/revise-srs`: refine query, retrieve, target-only proposal |
| Naskah / Error Handler | Event gagal teredaksi, error routing dan recovery marker |
| Naskah / Smoke / deepseek | Model/completion melalui credential bound |
| Naskah / Smoke / embeddings | Embedding request dan validasi 1536 dimensi |
| Naskah / Smoke / Supabase | Probe akses backend/RPC terautentikasi |
| Naskah / Smoke / Markdown | Shared renderer/validator parity |

`src` berisi builder/runtime/domain/schema; `prompts` scaffolds prompt; `workflows`
berisi artifact portable SDK/JSON. Build memakai shared `packages/core` dan Zod.
File portable tidak memuat key atau credential ID laptop; deploy mengikat
credential berdasarkan nama/type unik. Jangan commit hasil export execution/
credential atau parameter yang berisi secret.

Jalankan dari root dengan backend live dan mock provider sudah siap:

```powershell
pnpm n8n:build
pnpm n8n:deploy
pnpm test:b5
pnpm n8n:verify-markdown
```

Build hanya menghasilkan artifact; deploy mengubah workflow Naskah pada n8n
lokal. **Terapkan ulang sambungan** di Settings menggunakan mekanisme yang sama.
Node IDs/posisi/grup dipertahankan saat update; ambiguous name/type diblokir.
Webhook production memakai Header Auth; callback memakai bearer dan dedupe.
Jangan memakai `/webhook-test` sebagai endpoint aplikasi.

Model default generation pada implementasi `deepseek-flash`; checkpoint saat ini
tetap mengarah ke endpoint mock. Embeddings integrasi terpisah. Green smoke
mock tidak membuktikan keberhasilan API nyata. Kebijakan execution save-data
`none` bukan jaminan tidak ada persistence header sementara sebelum pruning;
perlakukan DB/log/trace backup privat.

Operasi/recovery: [runbook](../docs/runbook.md). Alur/error/retry dan deviasi loop:
[B5](../docs/B5-workflows.md). Browser integration: [B6](../docs/B6-local-ui.md).
Kontrak/payload: [contracts](../docs/contracts.md),
[Markdown](../docs/markdown-contract.md). Whole-system acceptance:
[B9](../docs/B9-end-to-end.md). Langkah API asli:
[checklist](../docs/real-api-checklist.md).
