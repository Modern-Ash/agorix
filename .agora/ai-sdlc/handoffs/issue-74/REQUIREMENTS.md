# Requirements - issue #74

## Functional requirements

- R1: Document every path that can change the canonical program.
- R2: State that AI-originated changes remain `ProgramProposal`-like provisional state until learner accept/modify/reject.
- R3: Define visible sequence for AI changes: intent, proposal, affected region, explanation, diff/preview, accept/modify/reject, canonical mutation only after acceptance.
- R4: Define Run, Step, Stop and Reset behavior.
- R5: Define current instruction highlighting for blocks and code.
- R6: Define loop and condition stepping behavior.
- R7: Define child-readable trace and before/after state expectations.
- R8: Define continuous code visibility rules across normal and narrow viewports.
- R9: Define matching semantics for Web/Tablet and Agorix Studio affordances.
- R10: Include Mermaid or wireframe-level diagrams sufficient for implementation.
- R11: Include Playwright-testable acceptance assertions.
- R12: Create an ADR that states runtime evidence, not AI language, is execution authority.

## Out of scope

- Implementing #75 proposal preview/diff UI.
- Implementing #76 Step execution.
- Implementing #77 execution trace UI.
- Implementing #78 E2E test itself.
