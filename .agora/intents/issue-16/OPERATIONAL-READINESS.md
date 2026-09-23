---
schema: "agora/operational-readiness/v1"
id: "issue-16-text-projection"
work: "text-projection/text-projection"
---

# Operational readiness: text projection

- **Availability**: ships as `@agorix/code-generator`'s public API on merge to
  `main`; consumed via the pnpm workspace protocol — no publish/deploy step for
  the POC.
- **Ownership**: developer role on the `text-projection` swarm; format or
  mapping changes are reviewed against `PROGRAMMING_MODEL.md`'s projection
  contract (deterministic snapshots are the compatibility signal).
- **Downstream consumers**: the always-visible code panel (editor shell) and
  block↔text highlight wiring consume `projectProgram` only; the runtime never
  imports generated text.
- **Dependency health**: only new dependency is `@agorix/program-model`
  (workspace link) — pure TypeScript, no third-party runtime packages;
  `pnpm lint` / `pnpm test` / `pnpm build` remain green (65/65 tests).
- **Safety**: generated text is read-only display output in the POC and is
  never executed; no network, storage, or secrets involved.
