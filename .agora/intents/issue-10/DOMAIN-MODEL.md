---
schema: "agora/domain-model/v1"
id: "issue-10-ux-requirements"
work: "issue-10-delivery/ux-requirements"
---

# Domain model: UX requirement categories

Not a code domain model — this deliverable is documentation. The "domain" is the set
of accessibility categories and how they relate to the editor surfaces from MVP.md
and LEARNER_JOURNEY.md.

## Entities

- **Requirement category**: one of the 10 categories from issue #10 (keyboard access,
  visible focus, non-color-only status, contrast, target sizing, drag alternatives,
  reduced motion, screen-reader labels, code-panel readability, narrow layout).
- **Editor surface**: an area from MVP.md/LEARNER_JOURNEY.md (Run/Stop/Reset, toolbox,
  workspace, code panel, mission panel, tutor panel) that one or more categories
  constrain.
- **Known limitation**: a documented gap where Blockly's stock capability does not
  meet a category (R6, R8) — recorded explicitly rather than silently unmet.

## Relationships

- Every requirement category → one or more editor surfaces it constrains.
- Every known limitation → the specific requirement category it partially satisfies.
- Layout-dependent requirements (R9, R10) → the LEARNER_JOURNEY.md D2 breakpoint
  decision they inherit.
