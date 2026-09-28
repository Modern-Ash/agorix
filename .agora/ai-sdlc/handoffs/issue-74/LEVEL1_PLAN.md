# Level 1 Plan - issue #74

1. Establish the transparent programming semantic model: intent, proposal, preview, learner decision, accepted canonical mutation, deterministic execution, evidence and reflection.
2. Document every program mutation path: direct learner edit, Action Palette edit, numeric modification, reorder/delete, accepted AI proposal, modified proposal, rejected proposal and future Studio diff flow.
3. Specify no-silent-mutation rules and rejection criteria.
4. Specify execution controls: Run, Step, Stop, Reset, current instruction highlight, loop/condition behavior, child-readable trace and before/after state.
5. Specify code visibility for Web/Tablet portrait, Web/Tablet landscape, desktop and Studio.
6. Define visual/provenance states: proposal vs accepted code vs executing instruction vs runtime evidence.
7. Add Mermaid/wireframe-level flows for ProgramProposal and runtime execution.
8. Create ADR explaining why runtime, not AI, is execution authority.
9. Add Playwright-testable assertions for #75-#78.
10. Verify with formatting and repository tests/build where applicable.
