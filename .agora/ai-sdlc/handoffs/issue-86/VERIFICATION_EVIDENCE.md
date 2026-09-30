# Verification evidence - issue #86

Tested commit: `385c7119bded2aa3a5c9a2a792306314d2cd5e43`

## Commands

- `pnpm --filter @agorix/web test -- src/App.test.tsx` - passed, 1 file / 14 tests
- `pnpm test` - passed, 31 files / 519 tests
- `aisdlc verify --swarm issue-86-delivery --work issue-86 --run --json` - passed for build and test; report persisted at `.agora/ai-sdlc/verification/issue-86/VERIFICATION.json`

## Acceptance mapping

- MC-001 / AC-001 clear intent progresses without unnecessary questions: `packages/tutor-contract/src/intent-plan.test.ts`, describe block `AC-001 clear intent progresses without unnecessary questions`.
- MC-002 / AC-002 ambiguous intent triggers a pedagogically useful clarification: `packages/tutor-contract/src/intent-plan.test.ts`, describe block `AC-002 ambiguous intent triggers a pedagogically useful clarification`.
- MC-003 / AC-003 planning performs no canonical mutation: `packages/tutor-contract/src/intent-plan.test.ts`, describe block `AC-003 planning performs no canonical mutation` verifies byte-identical program state, stable semantic hash, and no mutation across edit/accept/reject decisions.
- MC-004 / AC-004 plan references objective and concepts: `packages/tutor-contract/src/intent-plan.test.ts`, describe block `AC-004 plan references the learning objective and concepts where relevant`.
- MC-005 / AC-005 learner can edit/reject plan: `packages/tutor-contract/src/intent-plan.test.ts`, describe block `AC-005 the learner can edit or reject the plan`.
- MC-006 / AC-006 deterministic fake companion supports scenarios: `packages/tutor-contract/src/intent-plan.test.ts`, describe block `AC-006 the deterministic fake supports test scenarios`.
- MC-007 / AC-007 UI works without real provider credentials: `apps/web/src/App.test.tsx`, describe block `intent-to-plan dialogue (issue #86)`, test `shows no provider or credential surface next to the intent field`.

## Repair note

The final repair removed the initial suggestion provenance badge from the intent panel before a plan exists and added the expected accessible label to the intent input. This preserves the offline tutor unavailable state until a real plan/proposal exists.

## Environment note

The local environment uses Node `v20.19.0`; the repository declares Node `>=22 <23`, so pnpm prints an engine warning. The commands completed successfully.
