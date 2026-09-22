---
schema: "agora/unit-of-work/v1"
id: "issue-10-ux-requirements"
intent: "issue-10"
work: "issue-10-delivery/ux-requirements"
source: "https://github.com/Modern-Ash/agorix/issues/10"
---

# Unit of work: Issue #10 UX/accessibility requirements

## Scope

Draft and publish `docs/product/UX_REQUIREMENTS.md`: testable accessibility and
age-appropriate interaction requirements for the Agorix POC editor, written against
the concrete layout already decided in `LEARNER_JOURNEY.md` (issue #8, decisions
D1-D8) and the editor surface described in MVP.md.

## In scope

- Keyboard access to Run/Stop/Reset.
- Visible focus indication across the editor.
- Non-color-only status signaling (run state, success, error).
- Contrast requirements.
- Interactive target sizing guidance (touch-capable per MVP.md "Platform scope").
- Drag alternatives/limitations for the blocks workspace.
- Reduced-motion behavior.
- Screen-reader labels where Blockly permits (explicit limitations documented where
  it does not).
- Readability of the permanently visible generated-code panel (font, contrast,
  scroll — code never scrolls out of viewport per LEARNER_JOURNEY.md D2).
- Narrow desktop/tablet layout behavior (~768px breakpoint, stacked panels per
  LEARNER_JOURNEY.md D2).

## Out of scope

- Formal accessibility certification (explicit POC non-goal per issue #10).
- Any UI implementation or component code.
- Copy/wording (covered by issue #9 / CONTENT_GUIDE.md).

## Source material

- docs/product/MVP.md — required editor surface, platform scope, exit criteria.
- docs/product/PEDAGOGY.md — feedback philosophy (behavior-based, not color-only).
- docs/product/LEARNER_JOURNEY.md — D1 (60/40 split), D2 (narrow-viewport stack,
  pinned code band, 240px minimum), D4 (toolbox/stage/workspace layout), D5 (tutor
  overlay must not cover code panel).
- docs/product/PRODUCT_INTENT.md — audience (children).

## Dependencies

None blocking. Complements issue #8 (layout) and issue #9 (copy); all three feed the
same editor implementation.
