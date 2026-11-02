# ADR 001: Ports and adapters

Async TypeScript ports keep UI independent of browser fixtures and future HTTP
services. Only the registry chooses mode; Zod contracts validate boundaries.

# ADR 002: Generation event stream

Persist and announce chapters incrementally. A callback-driven n8n job can later
translate SSE/polling into the existing events without a UI rewrite.

# ADR 003: Data-driven standard

IEEE 830 is a template registry entry with required subsections and prompt paths.
Additional standards can supply data instead of conditional rendering.

# ADR 004: Browser compiler stand-in

Use real docx compilation and a print route in Phase 1. Preserve CompilerService
so server rendering can later return URLs through the same shape.

# ADR 005: Custom visual system

Use Radix primitives with bespoke semantic tokens. No shadcn scaffold or default
component styling is included. The document itself carries the visual identity.
