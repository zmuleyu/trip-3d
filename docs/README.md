# TRIP 3D documentation map

This repository keeps product, design, decisions, and delivery evidence separate
so that temporary implementation notes do not become product truth.

## Authority order

1. [`PRODUCT.md`](../PRODUCT.md) owns users, purpose, terminology, capabilities,
   constraints, brand commitments, and durable product principles.
2. [`DESIGN.md`](../DESIGN.md) owns the implemented visual and interaction
   system. Generated concepts remain evidence and proposals, not authority.
3. `docs/specs/` owns route- or feature-specific briefs and acceptance boundaries.
   A brief may specialize `PRODUCT.md` and `DESIGN.md` but may not contradict them.
4. `docs/adr/` is reserved for hard-to-reverse technical or product decisions
   with real alternatives and consequences. Ordinary UI choices do not need ADRs.
5. `docs/audits/` owns dated observations and evidence. Audits may motivate work
   but do not override product or design authority.
6. [`docs/followups.md`](followups.md) remains the canonical backlog for later
   capabilities and known limitations.
7. `collab/` contains historical execution records. It is evidence and context,
   not current product or design authority.

## Current design lane

- Product record: [`PRODUCT.md`](../PRODUCT.md)
- Baseline audit:
  [`docs/audits/2026-08-24-map-centered-experience-audit.md`](audits/2026-08-24-map-centered-experience-audit.md)
- Map-workspace design brief:
  [`docs/specs/2026-08-24-map-centered-workspace-redesign.md`](specs/2026-08-24-map-centered-workspace-redesign.md)
- Implemented design authority: [`DESIGN.md`](../DESIGN.md)
- Existing capability backlog: [`docs/followups.md`](followups.md)

## Naming

- Specs: `docs/specs/YYYY-MM-DD-<topic>.md`
- ADRs: `docs/adr/YYYY-MM-DD-<decision>.md`
- Audits: `docs/audits/YYYY-MM-DD-<scope>-audit.md`
- Runbooks: `docs/runbooks/<operation>.md`

Do not create parallel roadmap, backlog, design-system, or audit files when an
existing authority can be updated directly.
