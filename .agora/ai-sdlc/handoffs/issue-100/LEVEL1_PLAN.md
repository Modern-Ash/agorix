# Issue 100 Level 1 Plan

1. Inspect current Learning Companion, ProgramProposal, provider-runtime, tutor-api, and web proposal handling code.
2. Identify the narrowest shared validation boundary that can be reused by fake/local/remote provider outputs.
3. Define structured validation result types for safe child-facing messages and developer diagnostics.
4. Implement fail-closed validation for parsing/schema/capability/scaffolding/program/content/provenance layers.
5. Wire provider-runtime and/or tutor-api output paths through the boundary before UI/proposal consumption.
6. Add adversarial provider fixtures and conformance tests for local/fake and remote outputs.
7. Verify editor/runtime safe continuation after rejection.
8. Document security-oriented matrix and review checklist.
9. Run deterministic checks first under cheap-first economics; reserve model/reviewer budget only for semantic review after tests pass.
