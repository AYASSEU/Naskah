# Naskah conventions

- Phase 1 is a local, functioning UI with simulated generation and AI revision.
- Never call n8n, Supabase, DeepSeek, or Docker in Phase 1.
- Routes are thin. Features import domain logic, shared UI, and service ports.
- Only the service registry selects mock or live adapters.
- Shared Zod contracts live in packages/contracts.
- Strict TypeScript, including noUncheckedIndexedAccess.
- Persist local data in versioned IndexedDB; show recovery errors.
- Default interface locale is Indonesian; English lives in the same dictionaries.
- Brand and tagline are defined once in shared/config/brand.ts.
- Design: proofreading desk, manuscript serif, quiet neutral chrome.
- Gold marks the primary action, focus, active step, and changed text only.
- Literata for documents, Schibsted Grotesk for UI, JetBrains Mono for IDs.
- All colors are semantic CSS tokens; no decorative gradients or emoji.
- Tables and manuscript sheets have square corners. Buttons 4px; dialogs 8px.
- Respect keyboard navigation, reduced motion, and mobile reading.
- Pure logic belongs in entities; data never belongs inside UI components.
- Browser-only heavy tools load lazily: PDF parser, editor, diff, DOCX compiler.
- Commands: pnpm dev, typecheck, lint, test, build, audit:slop, check:contrast.
- Tooling uses cross-platform Node scripts rather than shell-specific commands.
- Live adapters deliberately report NotImplementedError until Phase 2.
- Keep docs/traceability.md and docs/backend-roadmap.md current.
- Repository was an empty folder with a brief; phase commits are deferred until
  the owner chooses to initialize Git.
