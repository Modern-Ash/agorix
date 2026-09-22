---
schema: "agora/implementation-plan/v1"
id: "issue-10-ux-requirements"
work: "issue-10-delivery/ux-requirements"
---

# Implementation plan: UX requirements

1. Read source material: MVP.md, PEDAGOGY.md, LEARNER_JOURNEY.md (D1-D8),
   PRODUCT_INTENT.md.
2. Derive requirements R1-R10 from issue #10's acceptance checklist
   (`.agora/intents/issue-10/REQUIREMENTS.md`), each as a discrete checkable
   assertion per the clarification answer on "testable."
3. Draft one section per required category (§1-§10), each with checkbox-style
   assertions and citations to the source constraint it derives from.
4. Cross-reference LEARNER_JOURNEY.md D2 for the two layout-dependent sections
   (code-panel readability, narrow layout) so they don't diverge from the already
   decided breakpoint/pinned-band behavior.
5. Explicitly document the two known Blockly limitations (drag-only placement,
   partial screen-reader navigability of the composition canvas) rather than
   omitting or overclaiming coverage.
6. Self-check the full draft against the R1-R10 traceability table
   (`TEST-STRATEGY.md`) before requesting product-owner review.

Executed by `project:ai-runtime-2` (developer) in this session; single pass, no
iteration needed beyond the self-check.
