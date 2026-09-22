---
schema: "agora/operational-readiness/v1"
id: "issue-11-monorepo-toolchain"
work: "monorepo-toolchain/monorepo-skeleton"
---

# Operational readiness: monorepo skeleton

- **Availability**: the skeleton ships in the repo on merge to `main`; any
  contributor can clone and run `pnpm install && pnpm run verify`.
- **Ownership**: developer role on `monorepo-toolchain` swarm maintains the
  toolchain; issue #29 hands CI enforcement to an automated pipeline.
- **Downstream consumers**: every subsequent implementation issue (#12-#31) builds
  inside this skeleton's `packages/*`/`apps/*` structure.
- **Dependency health**: `pnpm audit` is clean (0 known vulnerabilities) as of this
  work item's completion; re-run on future dependency bumps, not just at bootstrap.
- **Known environment gap**: `.nvmrc`/`engines` target Node 22; CI (issue #29)
  should pin a Node 22 runner so the declared engine and the enforced engine match.
