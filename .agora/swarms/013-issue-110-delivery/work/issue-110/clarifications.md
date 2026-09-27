---
schema: "agora/clarifications/v1"
swarm: "issue-110-delivery"
work: "issue-110"
created-at: "2026-09-27T02:10:42.381641Z"
last-run-input-sha256: "512cdfe91bdb4fd5ec8decd588c971bcc752b15ae8fa9c0a3b00ecd00de069d1"
last-run-question-count: 4
last-run-unanswered-count: 0
last-run-by: "project:ai-codex"
last-run-at: "2026-09-27T02:11:34.877423Z"
---

# Clarifications for issue-110

| Question | Answer | Actor | Timestamp | Input SHA-256 |
| --- | --- | --- | --- | --- |
| What is the full intent and acceptance criteria from GitHub issue #110, since the governed context only references the issue URL and does not include its contents? |  | project:ai-codex | 2026-09-27T02:10:42.381641Z | 512cdfe91bdb4fd5ec8decd588c971bcc752b15ae8fa9c0a3b00ecd00de069d1 |
| Has a Level 1 plan artifact been produced and approved for this work, as required by the AI-SDLC inception-approved gate? |  | project:ai-codex | 2026-09-27T02:10:42.381641Z | 512cdfe91bdb4fd5ec8decd588c971bcc752b15ae8fa9c0a3b00ecd00de069d1 |
| Has a bolt-plan artifact been produced and approved for this work, as required by the AI-SDLC inception-approved gate? |  | project:ai-codex | 2026-09-27T02:10:42.381641Z | 512cdfe91bdb4fd5ec8decd588c971bcc752b15ae8fa9c0a3b00ecd00de069d1 |
| Who must provide the human approval for the inception-approved transition: the assigned product-owner only, or both the product-owner and developer roles listed on the transition? | The transition lists both developer and product-owner roles, so both role responsibilities should be satisfied unless the Method Pack implementation defines one role as the sole approver. | project:ai-codex | 2026-09-27T02:10:42.381641Z | 512cdfe91bdb4fd5ec8decd588c971bcc752b15ae8fa9c0a3b00ecd00de069d1 |
| Are there any issue-specific NFRs, risks, measurement criteria, units of work, or suggested bolts that must be validated during inception before construction can begin? |  | project:ai-codex | 2026-09-27T02:10:42.381641Z | 512cdfe91bdb4fd5ec8decd588c971bcc752b15ae8fa9c0a3b00ecd00de069d1 |
| What is the full intent and acceptance criteria from GitHub issue #110, since the governed context only references the issue URL and does not include its contents? | Issue #110 asks Agorix to become a multilingual learning product for UI, curriculum, and Learning Companion. English and Spanish must be selectable; locale switching must not change canonical program hash or semantics; First Mission, run controls, proposal review, execution evidence, deterministic fake tutor, real-provider locale context, safety-critical copy, fallback, missing-translation diagnostics, third-locale extensibility, and README parity must be verified. The full elaborated trace is captured in INT-110.md, REQUIREMENTS.md, MEASUREMENT_CRITERIA.md, UNITS.md, BOLTS.md, and RISK_REGISTER.md. | project:ai-codex | 2026-09-27T02:11:34.877423Z | 512cdfe91bdb4fd5ec8decd588c971bcc752b15ae8fa9c0a3b00ecd00de069d1 |
| Has a Level 1 plan artifact been produced and approved for this work, as required by the AI-SDLC inception-approved gate? | A Level 1 plan artifact has been produced and registered as kind plan at .agora/ai-sdlc/handoffs/issue-110/LEVEL1_PLAN.md. It still requires explicit Product Owner and Developer approval before construction; no human approval has been inferred. | project:ai-codex | 2026-09-27T02:11:34.877423Z | 512cdfe91bdb4fd5ec8decd588c971bcc752b15ae8fa9c0a3b00ecd00de069d1 |
| Has a bolt-plan artifact been produced and approved for this work, as required by the AI-SDLC inception-approved gate? | A bolt-plan artifact has been produced and registered as kind bolt-plan at .agora/ai-sdlc/handoffs/issue-110/BOLTS.md. It decomposes delivery into foundation, curriculum, UI, companion, and evidence/docs bolts. It still requires explicit governed approval before construction. | project:ai-codex | 2026-09-27T02:11:34.877423Z | 512cdfe91bdb4fd5ec8decd588c971bcc752b15ae8fa9c0a3b00ecd00de069d1 |
| Are there any issue-specific NFRs, risks, measurement criteria, units of work, or suggested bolts that must be validated during inception before construction can begin? | Yes. The registered artifacts define issue-specific NFRs around safety, deterministic fallback, semantic integrity, maintainability, extensibility, accessibility, layout resilience, and developer diagnostics. Measurement criteria include EN/ES selection evidence, hash invariance, First Mission catalog completeness, localized UI/evidence controls, tutor locale behavior, provider locale propagation, missing-key diagnostics, third-locale extensibility, README parity, and repository verification. Risks include scope creep, safety translation drift, accidental semantic mutation, hard-coded strings, Spanish layout overflow, quiet missing keys, dependency fit, and README parity subjectivity. | project:ai-codex | 2026-09-27T02:11:34.877423Z | 512cdfe91bdb4fd5ec8decd588c971bcc752b15ae8fa9c0a3b00ecd00de069d1 |
