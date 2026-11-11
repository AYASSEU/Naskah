# Local parser and compiler

Final Windows startup/stop and backup ownership: [Windows guide](../docs/local-laptop-setup.md)
and [runbook](../docs/runbook.md). Compilation stays local independently of the
generation provider; current acceptance uses synthetic manuscripts/mock AI.

Run `pnpm.cmd local:compiler` from the repository root with Docker Desktop active.
`scripts/start-local.ps1 -Mode live` starts this automatically. Full operation,
security boundaries, acceptance commands and limitations: [B7 documents](../docs/B7-documents.md).

The Node HTTP service has unauthenticated `GET /health` and bearer-protected
`POST /parse` (PDF bytes) / `POST /compile` (Markdown and literal cover metadata).
Compile returns a ZIP containing refreshed `document.docx` and `document.pdf`.
Only the web server calls these internal endpoints. The web API owns auth,
shared text cleaning, persisted snapshots, private Storage and downloads.

`template.py` generates `template_ieee830.docx` during image build. `format.lua`
adds table captions. `compile.py` validates the Pandoc AST, formats the cover and
tables, then uses an isolated LibreOffice UNO profile to update the TOC and
produce both formats. `parse.mjs` releases PDF.js resources in a fresh child
process. `worker.mjs` bounds output/time and kills the complete job process group.
`docker exec naskah-compiler node --test worker.test.mjs` tests these bounds.

The helper supplies a private named font build context; do not copy font binaries
or populated environment files into this repository. Build-time QA intermediates
belong in ignored `artifacts/` or `compiler-service/output/`.

B9 startup uses Docker --init so orphaned LibreOffice/GPG descendants are reaped.
Do not omit it when launching the image manually. The runtime fingerprint includes
this setting so existing containers are recreated safely without touching Storage
or database volumes. Run node scripts/test-compiler-lifecycle.mjs for the repeated
compile/process-count acceptance.
