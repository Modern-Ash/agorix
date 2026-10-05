# Agora AI-SDLC projection evidence

Evidence snapshot: 2026-10-05.

This document records observable Agora AI-SDLC projection evidence for GitHub
issue #34. It intentionally separates durable Core facts from repository/GitHub
facts and does not treat local verification as Product Owner acceptance.

## Scope

The strongest complete scenario found in the repository is issue #87 / PR #158.
It demonstrates real Agorix work moving through Agora AI-SDLC operations, exact
artifact digests, runtime provenance, repeated verification and CI evidence.

The current work in PR #283 is used only as a fresh projection check. It is not
used as the producer/reviewer separation scenario because it has no recorded
independent review at this snapshot.

## Active projection check

Command:

```text
aisdlc status --json --detail --diagnostic
```

Observed result on 2026-10-05:

| Field               | Value                                                                             |
| ------------------- | --------------------------------------------------------------------------------- |
| Method              | `ai-sdlc`                                                                         |
| Profile/depth       | `starter` / `standard`                                                            |
| Actor/role          | `project:ai-runtime-2` / `developer`                                              |
| Active Core work    | `ci` / `repository-ci`                                                            |
| Active objective    | `Issue #29: Add repository CI for lint, typecheck, unit, build and browser smoke` |
| State/target        | `inception` -> `construction`                                                     |
| Usage status        | `unknown`                                                                         |
| Ready to transition | `false`                                                                           |

This proves profile/depth and actor projection are visible. It also exposes drift:
the active Core work still points at old CI work while the Git branch used for
the fresh PR was `feat/model-comparison-activity`.

## Scenario evidence: issue #87

Issue #87 is a real Agorix implementation scenario for proposal stale-state
behavior. The durable Core revision closed as completed:

| Fact                           | Value                                                              |
| ------------------------------ | ------------------------------------------------------------------ |
| Core work                      | `issue-87-delivery` / `issue-87`                                   |
| Revision                       | `1`                                                                |
| Final state                    | `completed`                                                        |
| Opened by                      | `project:product-owner`                                            |
| Closed by                      | `project:product-owner`                                            |
| Revision snapshot SHA-256      | `5fe036b725f6c7e392b83a5154f89f692603296f407c5765b2922ae18c28857d` |
| Revision metadata file SHA-256 | `2e13b225a35f2292411054eeb2ba4efd9f8e006bd0922b188cbf82cd33cdacfe` |

Producer/reviewer facts:

| Role                    | Actor                   | Evidence                                                                                                              |
| ----------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Producer                | `project:ai-opencode`   | Core artifacts/evidence and economics events for issue #87                                                            |
| Product owner gate      | `project:product-owner` | Core approval and revision close                                                                                      |
| GitHub author/merger    | `fabianaguero`          | PR #158 metadata                                                                                                      |
| Independent code review | Not recorded            | PR #158 has no GitHub reviews, and the operation notes say independent review had not yet occurred before PR creation |

The scenario therefore demonstrates producer attribution and human gate
separation, but it does not demonstrate a distinct digest-bound code reviewer.

## Exact artifact digests

Issue #87 registered operation artifacts with exact SHA-256 values:

| Artifact                                                      | SHA-256                                                            | Produced by                |
| ------------------------------------------------------------- | ------------------------------------------------------------------ | -------------------------- |
| `.agora/ai-sdlc/operations/issue-87/OPERATIONAL-READINESS.md` | `19eef01bfea4220ef1815d02fad915c422182fe90ca09ead6b1bb2c63fb45782` | `project:ai-opencode`      |
| `.agora/ai-sdlc/operations/issue-87/ROLLBACK-PROCEDURE.md`    | `68401b8f10756c698e45b5a97fd207be510acc4655528e826aa0b81367350180` | `project:ai-opencode`      |
| `.agora/ai-sdlc/operations/issue-87/EVIDENCE-INDEX.md`        | `f99ed6c802dc34379af84755d73d8100fc70c5ff724aa65f941cb6c4e2927e55` | repository file digest     |
| `.agora/ai-sdlc/verification/issue-87/VERIFICATION.json`      | `cfd0b350e20b839dd0c4260923d0fca1fe1c9ee02bcfe72304e81b4cbe903f50` | deterministic verification |
| `.agora/ai-sdlc/economics/issue-87/EVENTS.jsonl`              | `57bf234e8d93088a5c60baeb25287360435bee486994eebeac4208f81d487d79` | economics telemetry        |

The evidence index also records two command-output digests:

| Evidence          | SHA-256                                                            |
| ----------------- | ------------------------------------------------------------------ |
| deployment log    | `29cd4240fc9ab47fdf42a58888af5d81eed22af89edda68b8f784c1aa3785175` |
| security-scan log | `8ef3a3be143df3b2878c9d8443d33bd3da046b730b6c4ad3a83a3639e962d0ea` |

## Stale evidence behavior

Issue #87 demonstrates stale review/evidence behavior in two ways:

1. The operations evidence records that generated logs were rewritten in a later
   operations iteration and their digests changed. Any review bound to an older
   deployment/security-scan digest would no longer bind the current artifacts.
2. The operations readiness notes record a delivery blocker before PR creation:
   the behavior under review existed only as an uncommitted two-file delta on
   top of HEAD `385c7119bded2aa3a5c9a2a792306314d2cd5e43`. The verification
   `head` alone did not contain the behavior, so any review of HEAD without the
   delta would be stale or incomplete.

PR #158 later restored reviewable repository state by committing the delta and
running CI. It merged on 2026-09-30T12:24:51Z with all CI checks green, including
`lockfile-install`, `lint`, `format`, `typecheck`, `unit-tests`, `build`,
`boundary-check`, `browser-smoke`, `dependency-scan`, `security-baseline` and
`verify`.

## Runtime and metric evidence

Issue #87 economics telemetry contains 48 events from
2026-09-30T10:18:10.405723+00:00 through 2026-09-30T12:09:12.197471+00:00.

| Metric                     | Count |
| -------------------------- | ----: |
| context events             |     8 |
| decision events            |     8 |
| attempt events             |    16 |
| success events             |    16 |
| `system0` tier decisions   |     8 |
| `override` tier executions |    16 |
| `opencode` agent events    |    32 |
| no-agent/system events     |    16 |

The telemetry includes `system0` decisions where generative calls were avoided,
estimated context window measurements, and `opencode` execution attempts/successes.
The Core usage object has no budget consumption populated, so budget usage remains
unavailable for this scenario.

## Fresh PR projection: #283

PR #283 (`feat(learning-evidence): add model comparison activity`) provides a
fresh GitHub-side projection after this document's scenario was selected.

| Fact                        | Value                                           |
| --------------------------- | ----------------------------------------------- |
| PR                          | `https://github.com/Modern-Ash/agorix/pull/283` |
| Commit                      | `e16511b395f6b4f2b532ee7807c56994a219d6ec`      |
| Producer in commit metadata | `faguero`                                       |
| GitHub reviews              | none recorded                                   |
| CI status                   | all checks successful                           |

CI passed twice for the same PR head, including `browser-smoke`,
`vscode-extension-smoke` on stable and 1.95.0, `security-baseline`, `verify`,
`unit-tests`, `typecheck`, `lint`, `format`, `dependency-scan`,
`lockfile-install`, `boundary-check` and `build`.

Local AI-SDLC verification against the same branch was also run with:

```text
aisdlc verify --run --no-write --json
```

It passed `pnpm build` but failed `pnpm test` only because the managed sandbox
blocked loopback listeners with `listen EPERM 127.0.0.1` in
`extensions/vscode/src/studioProvider.test.ts`. Running `pnpm test` outside that
sandbox passed earlier for the PR, and GitHub CI also passed. This is runtime
provenance evidence: sandbox execution and GitHub CI are distinguishable.

## Acceptance mapping for #34

| Acceptance item                                | Status                   | Evidence                                                                                                                      |
| ---------------------------------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Producer session attributable                  | Demonstrated             | issue #87 producer `project:ai-opencode`; #283 commit `e16511b`                                                               |
| Reviewer distinct where policy requires        | Partially demonstrated   | Product Owner gate is distinct; digest-bound independent code review is not recorded                                          |
| Review binds exact digest                      | Not fully demonstrated   | artifact/evidence digests exist, but no distinct review record binds them                                                     |
| Stale condition observable after change        | Demonstrated             | changed log digests and pre-PR dirty delta in issue #87 operations evidence                                                   |
| Projection surfaces profile/separation/metrics | Demonstrated with caveat | `aisdlc status` exposes profile/depth/actor; economics events expose route/runtime metrics; active Core work drift is visible |
| No private side-channel data required          | Demonstrated             | all facts come from repo files, `aisdlc` output and GitHub PR metadata                                                        |
| Evidence documented here                       | Demonstrated             | this file                                                                                                                     |

## Conclusion

Agora AI-SDLC projection is useful enough to expose profile/depth, actor
provenance, exact artifact digests, stale evidence and runtime/metric telemetry
from real Agorix work. The remaining gap for #34 is narrower and clearer:
repository evidence does not yet include a distinct, digest-bound reviewer record
that becomes stale after an artifact revision and is then restored by a new
digest-bound review.
