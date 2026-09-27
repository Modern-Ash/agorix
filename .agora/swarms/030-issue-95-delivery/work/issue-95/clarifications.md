---
schema: "agora/clarifications/v1"
swarm: "issue-95-delivery"
work: "issue-95"
created-at: "2026-09-27T18:30:46.630291Z"
last-run-input-sha256: "bfc0fba159015ead43e1244e7c3d7f6e87d9ce986207f8690c6845381ac4ef28"
last-run-question-count: 5
last-run-unanswered-count: 0
last-run-by: "project:ai-codex"
last-run-at: "2026-09-27T18:30:46.630291Z"
---

# Clarifications for issue-95

| Question | Answer | Actor | Timestamp | Input SHA-256 |
| --- | --- | --- | --- | --- |
| What is the full intent and acceptance criteria from GitHub issue #95 that must be satisfied before the inception-approved gate can be considered? | Migrate the existing real-LLM tutor work into optional commercial provider adapters behind the provider-neutral LearningCompanion/provider-runtime architecture. Acceptance requires the #27 scope to be mapped as preserved/superseded/migrated, one optional remote adapter to pass common conformance tests, no secret to reach browser or source, remote/local provider switching to preserve curriculum/runtime semantics, and docs/README content to avoid implying a preferred proprietary vendor. | project:ai-codex | 2026-09-27T18:30:46.630291Z | bfc0fba159015ead43e1244e7c3d7f6e87d9ce986207f8690c6845381ac4ef28 |
| Where are the required inception artifacts stored or expected to be produced: intent, requirements, unit-of-work, plan, and the required bolt-plan artifact kind? | The inception artifacts are produced under repo://.agora/ai-sdlc/handoffs/issue-95/: INTENT.md, REQUIREMENTS.md, UNIT_OF_WORK.md, LEVEL1_PLAN.md, and BOLTS.md, with supporting USER_STORIES.md, NFR.md, MEASUREMENT_CRITERIA.md, RISK_REGISTER.md, and INCEPTION_HANDOFF.md. | project:ai-codex | 2026-09-27T18:30:46.630291Z | bfc0fba159015ead43e1244e7c3d7f6e87d9ce986207f8690c6845381ac4ef28 |
| Who must provide the human approval for the inception-approved gate, given the Method Pack requires developer and product-owner roles? | developer is assigned to project:ai-codex and product-owner is assigned to project:product-owner; both roles are required for the inception-approved transition. | project:ai-codex | 2026-09-27T18:30:46.630291Z | bfc0fba159015ead43e1244e7c3d7f6e87d9ce986207f8690c6845381ac4ef28 |
| Are there any referenced specifications, risks, NFRs, Measurement Criteria, Units, or suggested Bolts for issue #95 outside the GitHub issue body? | Yes. Legacy issue #27 provides the original real-provider tutor constraints. The current implementation in apps/tutor-api preserves server-only env secrets, timeout/cancellation, validation, minimal context, and fallback semantics. Completed provider-runtime issues #85, #92, #93, and #94 provide the current provider-neutral LearningCompanion contract and fake/local/remote adapter patterns that #95 must use. | project:ai-codex | 2026-09-27T18:30:46.630291Z | bfc0fba159015ead43e1244e7c3d7f6e87d9ce986207f8690c6845381ac4ef28 |
| What evidence should be checked to determine whether the inception-approved gate is blocked by missing artifacts or missing role approval? | The gate should fail closed unless the required Level 1 plan and bolt-plan artifacts are present, required inception artifacts are available, and both required roles have approved. | project:ai-codex | 2026-09-27T18:30:46.630291Z | bfc0fba159015ead43e1244e7c3d7f6e87d9ce986207f8690c6845381ac4ef28 |
