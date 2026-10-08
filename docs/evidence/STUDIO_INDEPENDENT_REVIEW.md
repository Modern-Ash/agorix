# Studio independent review

Evidence snapshot: 2026-10-05.

This document records an independent review pass over the merged Studio work on
`origin/main` after all related GitHub issues were closed. The review focused on
the already-merged Studio agent loop, proposal handling, live synchronization,
provider boundary, educator evidence export and the learner-facing model
comparison activity.

## Review Setup

| Item                | Evidence                                                                                             |
| ------------------- | ---------------------------------------------------------------------------------------------------- |
| Review branch       | `review/studio-independent-a`                                                                        |
| Base                | `origin/main` at `afae0a5` (`Merge pull request #286`)                                               |
| Issue state checked | `gh issue list --state open --json number,title,state` returned no open issues                       |
| Reviewer separation | Two independent review sessions were used: one pedagogy/product pass and one technical/security pass |
| Local worktree      | `/home/faguero/dev-agora/.agorix-review-a`                                                           |

The review did not update GitHub issue state because #242, #243-#259, #239,
#101 and #34 were already closed.

## Findings Fixed

| Severity | Area                          | Finding                                                                                         | Fix                                                                                                                                                                    |
| -------- | ----------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| High     | Predict-before-accept         | Proposal and alternative runtime outcomes could be displayed before the learner predicted.      | `AgentPanel` now hides proposal, alternative and selection runtime evidence while a required prediction is pending.                                                    |
| High     | Prediction binding            | A prediction could survive switching alternatives and then be used for a different proposal.    | `agentHost` binds pre-accept predictions to the current `proposalId` and clears the prediction when an alternative is chosen.                                          |
| High     | Modified candidate prediction | A learner-edited operation subset is a different candidate from the predicted proposal.         | Under `requirePredictionBeforeAccept`, operation subset editing and preview are disabled/refused so the prediction applies to the exact proposal accepted.             |
| High     | Decision race                 | Two fast `decideProposal` messages could both enter apply for the same pending proposal.        | `agentHost` now ignores proposal decisions while an apply is already in progress; regression coverage asserts one commit.                                              |
| Medium   | Stale edit protection         | Workbench mutating intents could omit `baseHash` and still mutate canonical state.              | `workbenchHost` now requires the current `baseHash` for `insertBlock`, `moveBlock` and `deleteBlock`; non-mutating reveal/review/agent intents still route without it. |
| Medium   | Evidence export overwrite     | Export wrote an adjacent Markdown summary without confirming whether that path already existed. | Export now writes the chosen JSON and only writes the derived local Markdown summary when it would not overwrite an existing file.                                     |

## Deferred Observations

| Area                         | Status                                                                                                                                                                              |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full i18n                    | Deferred to the polish phase. The agent panel has localized copy, but the broader Workbench and canvas still include English literals.                                              |
| Density by stage             | Deferred to the polish phase. Existing density behavior is manually controlled rather than stage-derived.                                                                           |
| Canvas accessibility         | Deferred to the polish phase. The review did not complete a full keyboard/screen-reader audit of the canvas.                                                                        |
| Assistance ceiling semantics | Needs product clarification. The current ceiling is recorded through effective scaffold level; stricter proposal suppression by level should be specified before changing behavior. |
| Explain-after strictness     | Needs product clarification. Current behavior prompts explanation but allows skip; that may be intentional if reflection is non-blocking.                                           |
| Provider text echo           | Needs product/privacy policy clarification. Provider `purpose`/`rationale` are bounded before display, but display is not the same as sanitization.                                 |

## Verification

Commands run from the review worktree:

```text
pnpm install --frozen-lockfile
pnpm format:check
pnpm tsc --noEmit
pnpm lint
pnpm --filter @agorix/studio-ui test -- agent.test.tsx
pnpm --filter @agorix/studio-protocol test -- index.test.ts
pnpm --filter agorix-studio test -- host/agentHost.test.ts host/workbenchHost.test.ts extension.test.ts
pnpm test
pnpm build
pnpm security:check
pnpm --dir apps/web exec playwright test e2e/model-comparison.spec.ts
```

Results:

| Check                               | Result                                                                                                                                                             |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Format                              | Pass                                                                                                                                                               |
| TypeScript                          | Pass                                                                                                                                                               |
| Lint                                | Pass                                                                                                                                                               |
| Focused UI/protocol/extension tests | Pass                                                                                                                                                               |
| Full unit test suite                | Pass: 93 files, 1142 tests. First sandbox run failed only because loopback listeners were blocked with `listen EPERM 127.0.0.1`; rerun outside the sandbox passed. |
| Build                               | Pass                                                                                                                                                               |
| Security baseline                   | Pass, including built client bundle scan                                                                                                                           |
| Model comparison e2e                | Pass: 7 tests. First sandbox run could not start the Vite preview server; rerun outside the sandbox passed.                                                        |

## Conclusion

The independent review found real issues in the already-merged Studio loop. The
highest-risk issues were fixed with regression tests: prediction is no longer
undermined by pre-revealed runtime evidence, proposal decisions are race-safe,
and canonical Workbench mutations require freshness evidence. The remaining
items are product/polish work rather than release-blocking correctness defects.
