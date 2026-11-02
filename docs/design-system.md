# Proofreading desk

Tokens are defined only in `apps/web/src/shared/styles/tokens.css`. Dark mode
uses warm black, ink, and stone; light mode uses a neutral paper desk. Gold is
a proofreader's marker: primary action, active contents entry, changed phrase,
keyboard focus. It is never a decorative background or headline effect.

Literata carries document prose and page headings. Schibsted Grotesk carries
navigation, forms and tables. JetBrains Mono is limited to identifiers, code,
filenames, and genuine numeric process data. All are self-hosted via next/font.

Buttons/inputs use 4px radius; panels/dialogs 8px; tags 2px. Tables and
manuscript surfaces remain square. Pills are limited to switches. Hairlines and
tonal levels establish hierarchy. Shadows are limited to overlay surfaces.

Radix Dialog, AlertDialog, DropdownMenu, Switch and Tabs supply focus behavior
and accessibility. One line icon family uses 1.5px strokes. Keyboard focus uses
an offset gold outline. Color is paired with labels and explicit status text.

Text pairings checked by `scripts/check-contrast.mjs`: primary/secondary/tertiary
ink on canvas and panels, positive/danger on panel, marker text on panel, ink on
gold, and paper ink on manuscript. Gold text on light mode uses a darkened token
`#806100` for WCAG AA. Gold fills retain the specified `#E6B422`.

The ledger is a table with one asymmetric continuation panel, not a grid of
cards. The preview contains a miniature manuscript, not decorative imagery.
At narrow widths secondary table columns are removed while document title,
status and actions remain. Workspace contents become a drawer; the inspector
becomes a bottom sheet. Reduced motion removes all transitions and entry fades.

Automated audit checks fonts, semantic colors, gradients, blur, emoji, repeated
card patterns, stock copy, infinite animation and tracked uppercase labels.
The audit is a heuristic; manual screenshot review remains necessary.
