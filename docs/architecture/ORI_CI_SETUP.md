# Ori integration CI: cross-repository access and quality gates

## Current CI behavior
The `Ori Integration CI` workflow runs on PRs into `integration/ori` and pushes to that branch. Formatting, lint, TypeScript, full tests and build run as independent jobs. The separate real-process interoperability job must also pass.

## Required repository secret
`Modern-Ash/ori` is private. The default Agorix `GITHUB_TOKEN` does not automatically grant read access to that separate repository. Configure a fine-grained GitHub token:

1. Create a fine-grained token owned by an identity authorized to access `Modern-Ash/ori`.
2. Restrict repository access to **only** `Modern-Ash/ori`.
3. Grant **Contents: Read-only**. No write or Actions permissions are needed.
4. If the organization requires token approval, obtain that approval.
5. In `Modern-Ash/agorix`, open **Settings → Secrets and variables → Actions → New repository secret**.
6. Name the secret `ORI_READ_TOKEN` and paste the token there. Never commit it, print it, or send it in chat.
7. Re-run the failed `Real Ori process interoperability` job, or trigger a new CI run.

The workflow checks for this secret before attempting checkout and **fails closed** if it is absent. Forked pull requests may not receive repository secrets; their interoperability check must not be reported as passing.

## Gates before merging
- Formatting, lint, TypeScript, tests, build and interoperability all green.
- Explicit `ORI_INTEROP_VERIFY: PASS` marker from the real-process test.
- No bypass of the private-repository check or replacement with a synthetic-only test.
- Human review before merge to `integration/ori`.
- No promotion to `main` or `development` without separate approval.

## Maintenance
A one-time formatting workflow with `contents: write` was used during initial setup. It is removed by this PR. Future formatting must be performed in feature branches and reviewed normally.
