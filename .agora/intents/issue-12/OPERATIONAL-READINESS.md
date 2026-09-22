---
schema: "agora/operational-readiness/v1"
id: "issue-12-program-model-schema"
work: "program-model/schema-v1"
---

# Operational readiness: program-model schema

- **Availability**: ships as `@agorix/program-model`'s public API on merge to
  `main`; consumed via the pnpm workspace protocol, no publish/deploy step.
- **Ownership**: developer role on `program-model` swarm; future schema changes
  (new Statement/Expression variants) are a versioned change (a v2 literal), not
  a mutation of v1's contract, per PROGRAMMING_MODEL.md's invariant.
- **Downstream consumers**: `apps/web` already imports it; issues #13-#17, #28
  will import `validateProgram`/types directly.
- **Dependency health**: `pnpm audit` remains at 0 known vulnerabilities (no new
  dependencies added in this issue — pure TypeScript, no new packages).
