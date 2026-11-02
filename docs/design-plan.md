# Design plan

The application is a proofreading desk. Its first screen is a project ledger.
Dark canvas #0B0A08, panels #12110E and #1A1813, rules #2B2820, warm ink
#ECE8DD, secondary ink #B5AE9E, gold marker #E6B422. Light mode uses a stone
canvas #F6F5F1, warm white panels and a white manuscript, with dark gold text.
Exact tokens and accessible pairings live in tokens.css.

Literata: document text and page headings. Schibsted Grotesk: interface.
JetBrains Mono: requirement identifiers, filenames, session identifiers.

Ledger:

```
wordmark / Dokumen                        Evaluasi   locale theme settings
Dokumen Anda                                    Proyek baru
description                          quiet count summary
continue reading [document preview | title, progress | Lanjutkan]
search                      status filter / view controls
title                         domain    progress   status   updated   menu
```

Workspace:

```
wordmark / project                 save status  finalize
contents 240px | manuscript, 68ch reading measure | inspector 290px
chapters      | IDs in margin / prose            | quality / sources
              | edit / revision per section     | versions
```

Review against brief section 6.1: removed the usual metric card grid, persistent
dashboard sidebar, gradients, decorative illustration, rounded status pills,
and hero messaging. The pinned document is an asymmetric reading preview.
Thin rules and spacing carry hierarchy. Gold occupies a small fraction of the
screen. Only active items, marks, focus, and primary actions use it.
