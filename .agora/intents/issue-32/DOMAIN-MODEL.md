---
schema: "agora/domain-model/v1"
id: "issue-32-agora-bootstrap"
work: "product-poc/product-foundation"
---

# Domain model: Agora bootstrap

Not a code domain model — this deliverable is governance configuration and a
confirmation report.

## Entities

- **Bootstrap requirement**: one of R1-R6, each mapping to one issue #32 checkbox.
- **Actor runtime declaration**: an `.agora/actors/*.md` entry with `integration`,
  `provider`, `model` — the unit R4 counts.
- **Governance artifact**: a project-level file (`project.md`, `project.yaml`) whose
  fields R2/R5 inspect.

## Relationships

- Every bootstrap requirement → the evidence source that satisfies it (a command
  output, a file field, a grep result) — recorded 1:1 in
  `BOOTSTRAP-CONFIRMATION.md`.
- R6 → downstream dependency on issue #11 (build tooling), re-verified once that
  lands.
