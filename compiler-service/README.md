# Phase 2 compiler plan
Replace browser CompilerService with a queued server compiler. Validate document
contracts, render a versioned IEEE template via python-docx/Pandoc, then convert
using LibreOffice headless or WeasyPrint. Provide a cover, automatic contents,
hierarchical heading numbering, captioned tables, page numbers, A4 paper,
Times New Roman 12pt, 1.5 line spacing and 4/4/3/3 cm top/left/right/bottom
margins. Return short-lived artifact URLs. Sanitize source and isolate the
conversion process. This folder is documentation only; no service is started.
