# B7 local document services

Completed on 2026-11-10 with local Docker, Supabase and the mock AI provider.
The live webapp sends uploads and export requests only to its own API.

## Use from the UI

Open `http://127.0.0.1:3000/new-project`. Upload PDF/TXT, add notes, then generate
and revise as in B6. Scanned PDFs need an external OCR step before upload; this
phase detects missing text and explains that action rather than guessing text.
TXT must be UTF-8. Uploaded source files are processed temporarily, not stored.

After reviewing and finalizing a document, open Export. Optional author and
institution fields appear on the cover. Word and PDF download actual files.
The server updates the Word contents field before producing both formats.

## Start and stop on Windows

From the repository root:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-local.ps1 -Mode live
```

The existing startup helper starts Docker/n8n/mock provider and local Supabase;
it now also invokes `node scripts/local-compiler.mjs` before starting the UI.
The document helper builds an image when source/font fingerprints change and
otherwise starts the existing `naskah-compiler` container. Its port is bound only
to `127.0.0.1:8000`. `/health` reports non-secret tool versions and process RSS.
Stop just this service with `docker stop naskah-compiler`; restart using
`pnpm.cmd local:compiler`. No n8n volumes or credentials are recreated.

The helper creates `COMPILER_SERVICE_TOKEN` in ignored `apps/web/.env.local` and
a token-only Docker env file under `%LOCALAPPDATA%\naskah-runtime\compiler.env`.
It copies installed Windows Times New Roman files to a private Docker build
context. Font binaries are not committed. Other machines without that font use
Fontconfig's installed serif fallback; check `/health` when reproducing layout.
The image pins Node 24.22.1 by digest and pdfjs-dist 6.4.299 by lockfile. Observed
Debian tools: Pandoc 2.17.1.1 and LibreOffice 7.4.7.2. The image identifier and
actual tool/font versions participate in the export cache fingerprint.

To explicitly select the original browser compiler, set `COMPILER_MODE=client`
in `apps/web/.env.local` and restart the webapp. The server parser still runs.
There is no silent fallback when the server is unavailable. Mock UI mode keeps
the Phase 1 browser parser/compiler. AI providers remain mock in both modes.

## API and processing boundaries

| Route | Input | Output |
| --- | --- | --- |
| `POST /api/parse-pdf` | multipart form, exactly one `file` | `ParsedDocumentSchema` |
| `POST /api/compile-document` | `CompileInputSchema`, optional author/institution | `CompileResultSchema` |
| `GET /api/exports/{uuid}` | signed owner cookie | private streamed attachment |

All three routes require the local owner session; mutations enforce origin and
rate limits. No browser receives a Supabase/service credential or calls port
8000 directly. Export metadata reuses the existing owner-scoped `exports` table;
no schema migration or grant expansion was needed. Storage stays private.
The download API creates a 60-second signed Storage URL server-side, then streams
it through the authenticated same-origin response with `no-store` and attachment
headers. Returned API URLs remain usable by that owner until the export/project
is removed; the internal Storage signature is short-lived.

Uploads are bounded to 10 MiB plus 64 KiB multipart overhead, 200 PDF pages and
2 MiB extracted UTF-8 text. Files must have an allowed extension and valid PDF
magic. A new Node child process extracts each PDF, with a 20-second deadline,
128 MiB JS heap and bounded stdout. PDF.js page resources/loading tasks are
destroyed; the child exits after every call. Next reuses the exact Phase 1
`cleanPages` function. TXT uses strict UTF-8 decoding before the same cleaning.
Errors include `invalid_file`, `invalid_encoding`, `encrypted_pdf`, `page_limit`,
`no_text_layer`, `too_large`, `document_timeout` and `document_busy`, localized
in Indonesian and English.

Compilation snapshots an owned finalized project/template under the project
lock, then releases the transaction while processing. The shared Markdown
renderer supplies the manuscript. Pandoc reads GFM into an AST; images/raw
nodes cannot cause local/remote resource reads. Numeric heading prefixes are
removed only in the compiler AST, then Pandoc numbers the same hierarchy once.
A fixed Lua filter supplies missing table captions. The reference generator
sets A4, Times New Roman 12 pt body/tables, 1.5 spacing, 4 cm top/left and 3 cm
right/bottom margins. Heading/cover sizes vary for hierarchy. Tables wrap and
repeat their first row. The cover includes title, project, version, author,
institution and project creation date; the footer has a PAGE field.

A private LibreOffice UNO process/profile refreshes indexes and fields, saves
DOCX, then exports PDF. Macros and external link updates are disabled. Both files
come back in a bounded ZIP; each is limited to 25 MiB and stored in the private
bucket. Concurrent requests for one snapshot coalesce within this single local
web server. Content/tool/font fingerprints select the cache. Different snapshots
produce different objects. Project deletion removes its Storage objects before
deleting metadata; a failed removal leaves the project available for retry.

The container runs as non-root with a read-only filesystem, 512 MiB temporary
filesystem, dropped capabilities, no-new-privileges, 1 GiB memory, 2 CPUs and
128 PIDs. Two jobs may run at once; excess work gets a retryable busy response.
Compilation has a 90-second deadline. A timeout kills the whole owned process
group, including LibreOffice, and removes its temporary directory. Document
bodies and bearer tokens are not logged by the service.

## Reproduce acceptance

With the live backend and compiler running:

```powershell
pnpm.cmd test:b7
docker exec naskah-compiler node --test worker.test.mjs
$env:NASKAH_E2E_MODE='live'
pnpm.cmd exec playwright test live-workflows.spec.ts server-parser.spec.ts
python scripts/verify-b7-documents.py
```

The Python verification command needs `pypdf` and `pdfplumber`; the bundled Codex
Python was used on this laptop. Synthetic PDFs/TXT are committed under
`tests/fixtures/documents`; `generate.py` regenerates them with ReportLab/pypdf.
Do not use real patient data for acceptance. Reports and compiled/rendered files
live under ignored `artifacts/b7`.

Six HTTP acceptance groups pass: session/origin/internal bearer guards,
PDF/TXT shared cleaning, input/error bounds, parser soak, hospital export/cache/
private downloads, and rejection of external images. The soak performs 20 warm-up
calls plus 200 measured calls; persistent service RSS stays within a 16 MiB band
and net growth below 8 MiB. Final measured band: 6,684,672 bytes. This is a bounded
allocator plateau test, not an assertion that RSS is bit-identical on each call.
Five worker tests exercise successful output, forced timeout, output overflow,
stable failure codes and descendant cleanup after a failed parent. Four UI cases
pass across light/dark, including PDF/TXT
generation, edit/revision/finalization, real DOCX/PDF downloads, browser/server
PDF parity and scanned-PDF OCR advice.

Hospital acceptance produces 22 pages, 3 captioned tables and all 39 requirement
IDs. TOC chapter starts are pages 4, 6, 8 and 18, checked against actual pages.
OOXML margins/font/spacing and PDF page size/bounds/footer numbers pass. The
packaged `render_docx.py` was run in a network-disabled QA container because
Windows has no bundled LibreOffice; bundled pdf2image plus Linux Pillow/Poppler
were used there. All 22 final PNG pages were inspected, including repeated table
headers on pages 21/22. No clipped text, missing glyphs or overlapping tables
were observed. Pagination can vary with tool/font versions.

## Implementation choices and limits

- The service uses Node HTTP plus Python/UNO, which the brief permits. The cover
  is added through python-docx rather than a Lua cover filter to keep literal
  author/institution text out of Markdown interpretation. Lua handles captions.
- Pandoc 2.17's DOCX writer cannot read its embedded resources with `--sandbox`.
  The Markdown reader uses sandbox mode; the writer receives the validated AST
  and fixed local reference/filter. No source-controlled resources are fetched.
- Signed Storage URLs stay behind the same-origin API to preserve the browser
  boundary. The API URL itself is session-protected, not a bearer URL.
- This is a bounded two-worker local service, not a durable distributed queue.
  Request retry is the recovery mechanism; caching coalesces one local server.
- OCR, embedded images and external resource fetching are outside B7. Research
  persistence/evaluation and final runbooks remain B8–B10. No paid provider was
  used and these synthetic artifacts are not thesis results.
