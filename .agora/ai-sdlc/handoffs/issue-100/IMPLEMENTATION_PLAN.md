# Issue 100 Implementation Plan

1. Add shared safety diagnostic/error types to `@agorix/tutor-contract`.
2. Add `validateLearningCompanionSafety(request, response)` on top of existing schema validation.
3. Validate PII-seeking content, over-assistance, hidden provider actions, stale/unsafe ProgramProposal output and invented debugger facts.
4. Wire fake, Ollama and OpenAI-compatible provider-runtime success paths through the safety validator.
5. Add adversarial contract tests.
6. Add local/remote adapter consistency tests.
7. Add safety documentation and review checklist.
8. Verify with format, lint, focused tests, full tests and build.
