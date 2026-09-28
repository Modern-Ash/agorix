---
schema: "agora/clarifications/v1"
swarm: "issue-100-delivery"
work: "issue-100"
created-at: "2026-09-27T23:49:04.750000Z"
last-run-input-sha256: "a97762674d80ed114d60c394d83615c8c55f7e4c9c5ec354c8198b2bd00aff5f"
last-run-question-count: 0
last-run-unanswered-count: 0
last-run-by: "project:ai-codex"
last-run-at: "2026-09-27T23:51:26.280637Z"
---

# Clarifications for issue-100

Manual registration authorized by Product Owner: `autorizo registrar clarificaciones manuales de 100 porque la integración genérica no puede ejecutar agora work clarify`.

| Question | Answer | Actor | Timestamp | Input SHA-256 |
| --- | --- | --- | --- | --- |
| What is the main product boundary? | A single enforceable AI-output validation and child-safety boundary before learner UI, proposal workflow, diagnostics, or canonical mutation. | project:ai-codex | 2026-09-27T23:49:04.750000Z | 9d4d4d7cbbb7f3f483156320e49bfb2e8e49334b4428da5ac58f7f5315db842a |
| Which source dependencies are authoritative? | GitHub #100 depends on #85 Learning Companion, #87 ProgramProposal, and #92 provider-runtime. #90 scaffolding policy is referenced for anti-over-assistance; if construction finds #90 incomplete, use a minimal explicit policy seam for #100 without claiming #90 completion. | project:ai-codex | 2026-09-27T23:49:04.750000Z | 9d4d4d7cbbb7f3f483156320e49bfb2e8e49334b4428da5ac58f7f5315db842a |
| Does #100 require live provider calls? | No. Acceptance should use deterministic tests, mocked provider fixtures, and adversarial structured outputs so no credentials or network calls are required. | project:ai-codex | 2026-09-27T23:49:04.750000Z | 9d4d4d7cbbb7f3f483156320e49bfb2e8e49334b4428da5ac58f7f5315db842a |
| How does the current AI-SDLC economics framework affect #100? | Execute cheap-first: deterministic local validation and mocks first, no automatic frontier calls, paid-efficient/paid-standard review only within configured budgets, and usage recording only from authoritative telemetry. | project:ai-codex | 2026-09-27T23:49:04.750000Z | 9d4d4d7cbbb7f3f483156320e49bfb2e8e49334b4428da5ac58f7f5315db842a |
| What evidence should inception check before construction? | Required intent, requirements, unit-of-work, plan, bolt-plan, economics, risks, measurement criteria, and both Product Owner/developer approvals for revision 1. | project:ai-codex | 2026-09-27T23:49:04.750000Z | 9d4d4d7cbbb7f3f483156320e49bfb2e8e49334b4428da5ac58f7f5315db842a |
