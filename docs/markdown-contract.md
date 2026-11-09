# Shared Markdown contract, version 1

The pure implementation is `packages/core`. The web app and n8n Code-node bundle
consume the same implementation. Provider responses must first pass
`ChapterDraftSchema`; no provider credential is part of this contract.

## Manuscript grammar

- A chapter uses `# N. Title`; its subsections use `## N.M Title`.
- Narrative subheadings use level 3 or deeper and do not create application sections.
- A section number occurs once. Duplicate section/chapter numbers and an incorrect
  heading level are rejected rather than silently overwriting content.
- Numbered headings inside fenced code are data and never count as SRS structure.
- Structured rendering uses LF, one blank line between blocks and one final newline.
  Chapter order and subsection order come from the active template.
- Lossless parsing retains the preamble, heading spelling, original line endings,
  body whitespace, tables, comments and code. `renderParsedManuscript` reassembles
  those tokens. Editing one section's `body` leaves all other bytes intact.

## Requirement blocks

Canonical structured rendering is:

```markdown
**REQ-F-01 — Requirement title**
The system shall store validated input.

Prioritas: [High]

Aktor: Registered operator
Input: Validated input
Proses: Validation and storage
Output: Confirmation
```

IDs use `REQ-[A-Z]-digits` and must be unique across a manuscript. Titles are one
line; literal asterisks and backslashes are escaped. Multiline metadata continues
with two leading spaces. The parser also accepts the existing Phase 1 compact
`Aktor: ... · Input: ... · Proses: ... · Output: ...` line. Those legacy manuscripts
are preserved unchanged by the lossless parser; canonical rendering is not applied
silently to existing user edits. Missing metadata stays empty, rather than being
filled with invented actors or processes. A legacy block without a priority keeps
the Phase 1 default `High`. Metadata labels at the beginning of a line are reserved.

## Traceability and guardrail annotations

The traceability table has Kebutuhan, Use case and Metode verifikasi columns.
`renderTraceability` escapes literal pipes and converts cell line breaks to `<br>`.

Rewrite annotations use paired comments:
`<!-- naskah:rewrite:ID:start -->text<!-- naskah:rewrite:ID:end -->`.
IDs contain only letters, digits, underscores and hyphens and refer to a Rewrite
record. They are not executable instructions. The UI continues to sanitize HTML.

The deterministic numeric check sets `needs_confirmation` when a rewritten target
is absent from both the original statement and supplied user/retrieval context.
A model cannot clear that flag. Requirement IDs are excluded from numeric evidence.
Literal application requires exactly one occurrence and preserves requirement IDs.
This is a conservative lexical check, not proof that a measurement is scientifically
justified; equivalent units and inferred calculations still require human review.

## Acceptance evidence

`tests/markdown-contract.test.ts` checks the three existing Phase 1 fixture
manuscripts against committed golden files, structured field round trips, CRLF,
fences, section isolation, duplicate rejection, tables, markers and numeric claims.
`tests/n8n-markdown.test.ts` additionally checks the runner's restricted
property-definition APIs. The bundle returns a plain local result container,
because module export getters do not work in the hardened n8n runner.

On 2026-11-09 the authenticated production webhook for
`Naskah / Smoke / Markdown` returned byte-identical output for all three Phase 1
fixtures and a structured-requirement fixture; invalid webhook auth was rejected.
`pnpm n8n:verify-markdown` reproduces this check and writes a secret-free report
under ignored `artifacts/`. This verifies the renderer contract, not full SRS
generation, revision or error handling.

B5 additionally verifies byte identity between the actual Generate SRS callback
Markdown and `renderDocumentSections`, using its persisted document and callback
SHA-256. The real local workflow and revision/error acceptance are documented in
`B5-workflows.md`; the browser remains in mock mode until B6.
