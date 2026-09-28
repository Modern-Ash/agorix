# Issue 100 Clarifications

| Question | Answer | Source |
| --- | --- | --- |
| What is the main product boundary? | A single enforceable AI-output validation and child-safety boundary before learner UI, proposal workflow, or canonical mutation. | GitHub #100 |
| Which dependencies are authoritative? | #85 Learning Companion, #87 ProgramProposal, #92 provider runtime; #90 scaffolding policy is referenced for anti-over-assistance. | GitHub #100 |
| Does #100 require real provider calls? | No. Acceptance can and should use adversarial fixtures and mocked provider outputs. | AI-SDLC economics + #100 evidence |
| How does the new economics framework affect execution? | Use cheap-first deterministic verification, no frontier auto, bounded paid review, and usage recording only from real telemetry. | ai-sdlc/project.yaml + .agora/commands/execute.md |
| What remains human-governed? | Product Owner approval, developer approval, lifecycle transition to construction, acceptance, operations, and completion. | AI-SDLC 0.2.0 method |
