# Ori integration branch policy

## Purpose
Keep experimental Ori integration work isolated from Agorix's stable product development and other coding agents.

## Branches
- `main` / `development`: Agorix product work. **Do not target these from Ori integration PRs.**
- `integration/ori`: long-lived staging branch for Ori integration only.
- `feature/ori-*`: short-lived feature branches based on `integration/ori`; PRs must target `integration/ori`.
- `Modern-Ash/ori`: independent agent code and harness.

## Workflow
1. Create an Ori integration feature branch from `integration/ori`.
2. Implement a small scoped change; avoid unrelated UI, runtime, curriculum or product changes.
3. Run formatting, typecheck, unit tests, integration tests and safety checks.
4. Open a PR with base `integration/ori`; require human review and green CI.
5. Merge only to `integration/ori`; never auto-merge into `main` or `development`.
6. Reconcile changes from stable Agorix selectively after coordinating with the other coding agent. Prefer reviewed merges with conflict resolution and regression tests; do not force-push the integration branch.
7. Promotion into the stable branch requires an explicit separate PR, full product regression, child-safety review and owner approval.

## Current scope
Shadow transport and metadata-only pedagogical plans are experimental. They must remain disabled by default in production. Do not expose them directly to children.

## Collaboration
The other coding agent owns its functional workstream; Ori integration must not modify their branches, PRs or ownership boundaries. Coordinate shared files before touching `apps/tutor-api` or other common integration surfaces.

## Caveat
This policy is documented, not a GitHub branch-protection rule. Repository administrators should configure branch protections and required status checks for enforceable safeguards.
