---
schema: "agora/implementation-plan/v1"
id: "issue-32-agora-bootstrap"
work: "product-poc/product-foundation"
---

# Implementation plan: Agora bootstrap confirmation

1. Read docs/delivery/AI_SDLC_SETUP.md and docs/delivery/AGENTIC_DEVELOPMENT.md.
2. Confirm `.agora/project.md` already records the recommended flavor/profile/depth
   (R2) — no change needed.
3. Create swarm `product-poc` and work item `product-foundation` with the exact
   names issue #32 recommends (R3).
4. Declare a second distinct actor runtime (codex on `project:ai-primary`,
   alongside the existing claude on `project:ai-runtime-2`) to satisfy R4.
5. Run `agora validate` and capture the result as R1 evidence.
6. Grep `.agora/project.md`, `ai-sdlc/project.yaml` and `.agora/actors/*.md` for
   credential patterns to evidence R5.
7. Record R6 as trivially true at the current documentation-only repository state,
   flagged for re-verification once issue #11 lands.
8. Write `BOOTSTRAP-CONFIRMATION.md` mapping each requirement to its evidence.

Executed by `project:ai-runtime-2` (developer) in this session; single pass.
