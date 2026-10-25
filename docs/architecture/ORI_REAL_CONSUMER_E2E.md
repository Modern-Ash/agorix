# Real Ori plan consumer cross-repository smoke

This increment extends the existing optional real-process test to exercise **createOriPlanConsumer** against a separate real Ori reference HTTP process, not only the shadow transport.

## Assertions
- The consumer receives the `ori/shadow-plan/v1` contract from Ori over loopback.
- Stage, mission context, three steps and `appliedChanges: false` match expectations.
- The returned plan, steps and context are immutable.
- An independent request for a second pedagogical stage succeeds.
- No child-facing response, project mutation, persistence or LLM is involved.

## Required CI gate
The existing `Ori Integration CI` checks out both private repositories and runs `pnpm test:ori:interop`. A missing Ori checkout must fail the job rather than skip it. All formatting, lint, typecheck, unit tests, build and interoperability jobs must pass.

This proves read-only contract interoperability for synthetic metadata. It does **not** authorize use of Ori plans in Kids. A separate explicit feature gate, adult-only review, pedagogical evaluation and safeguarding assessment are still required.
