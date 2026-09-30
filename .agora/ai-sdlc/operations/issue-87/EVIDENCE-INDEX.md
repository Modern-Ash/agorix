<!-- agora-ai-sdlc:deterministic-operations/v1 -->

# Prepared evidence index — issue-87

Work: `issue-87-delivery/issue-87` · revision 1 · stage `operations`.

Non-authoritative preparation. Core owns artifact registration, evidence
recording, criterion stages, approvals and transitions.

## Artifact kinds registered in this iteration

| Kind | Registered path | SHA-256 | Produced by |
| --- | --- | --- | --- |
| `operational-readiness` | `repo://.agora/ai-sdlc/operations/issue-87/OPERATIONAL-READINESS.md` | `19eef01bfea4220ef1815d02fad915c422182fe90ca09ead6b1bb2c63fb45782` | `project:ai-opencode` |
| `rollback-procedure` | `repo://.agora/ai-sdlc/operations/issue-87/ROLLBACK-PROCEDURE.md` | `68401b8f10756c698e45b5a97fd207be510acc4655528e826aa0b81367350180` | `project:ai-opencode` |

Both were previously prepared but unregistered across four earlier operations
iterations; this iteration is where they were registered against revision 1.

## Evidence types recorded in this iteration

| Type | Source command | Result | Recorded artifact | SHA-256 |
| --- | --- | --- | --- | --- |
| `deployment` | `pnpm lint`, `pnpm tsc --noEmit`, `pnpm test`, `pnpm build` | success (all exit 0) | `repo://.agora/ai-sdlc/operations/issue-87/logs/deployment.log` | `29cd4240fc9ab47fdf42a58888af5d81eed22af89edda68b8f784c1aa3785175` |
| `security-scan` | `pnpm security:check` | success (`security baseline: PASS`) | `repo://.agora/ai-sdlc/operations/issue-87/logs/security-scan.log` | `8ef3a3be143df3b2878c9d8443d33bd3da046b730b6c4ad3a83a3639e962d0ea` |

Both logs were regenerated in this iteration, so both digests supersede all
previously indexed values. The re-run reproduced identical results: all five
gates exit 0, `pnpm test` 30 files / 488 tests, `security:check` 4 bundle files /
4 safety documents / 191 text files.

## Executed deterministic verification

`aisdlc verify --swarm issue-87-delivery --work issue-87 --run` was run during
this iteration, so the durable report is an executed result rather than a plan.

| Field | Value |
| --- | --- |
| Report | `repo://.agora/ai-sdlc/verification/issue-87/VERIFICATION.json` |
| SHA-256 | `cfd0b350e20b839dd0c4260923d0fca1fe1c9ee02bcfe72304e81b4cbe903f50` |
| `executed` | `true` |
| `all_executed_commands_passed` | `true` |
| `pnpm build` | passed, exit 0, 7.258 s |
| `pnpm test` | passed, exit 0, 1.485 s, 30 files / 488 tests |

This corroborates the `deployment` row above.

The report has now been re-executed on the same tree state and the same base HEAD
five times across these operations iterations, and every run reports
`all_executed_commands_passed: true`. Only elapsed times differ between runs.
Digest chain, oldest to newest:
`416f9395…` -> `1ce45d37…` -> `5516e576…` -> `cfd0b350…` (current).

## Drift check performed in this iteration

Before re-running anything, this iteration confirmed the recorded artifacts still
described the live tree: HEAD, the 2-file / +208-line product delta, and the
previously indexed digests all matched, and `gh pr list --head ai-sdlc/issue-87
--state all` is empty — so the uncommitted/no-PR residual risk is still current
and has not been silently resolved by an intervening human action.

No transient conformance probe was added in this iteration. The gate totals being
unchanged at 488 and `git status` still showing exactly the recorded 2-file delta
confirm no residue was left by this iteration's runs.

The AC-008 integration claims in `OPERATIONAL-READINESS.md` were source-verified
in an earlier iteration and no source file changed since, so they carry forward
unchanged.

## Environment of record

- Base HEAD at time of verification: `385c7119bded2aa3a5c9a2a792306314d2cd5e43`
- Verified tree state is HEAD **plus an uncommitted delta**: 2 files, +208 lines,
  both under `packages/proposals` (`src/index.ts` +16, `src/index.test.ts` +192).
  HEAD alone does not reproduce the recorded green results, and HEAD does not
  contain the behaviour under review. Committing that delta and opening the PR
  linked to issue #87 is outside this iteration's authority (`git.read` only).
- Branch: `ai-sdlc/issue-87`
- Node: `v20.19.0` (workspace declares `>=22 <23`; pnpm emits an engine warning and
  continues; all commands exit 0)
- Provider credentials used: none. The baseline and all gates are credential-free.
- Test totals recorded: `pnpm test` 30 files / 488 tests passed.

## Not performed by the executor

- Criterion `source-issue` remains at stages elaborated/designed/built/verified.
  The required stage is `accepted`, which is a human-owned decision. Findings P-1
  and P-2 in `OPERATIONAL-READINESS.md` are prepared for that decision and were
  not resolved unilaterally.
- No approval recorded, no criterion stage set, no lifecycle transition attempted
  and no `git` write performed. `gh` was used read-only to confirm no PR exists.
- The `completion` gate's remaining blocker after this iteration is criterion
  `source-issue` at stage `accepted`, which requires the human Product Owner.
