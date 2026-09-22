# UX requirements: accessibility and age-appropriate interaction

Traces to GitHub issue #10. Source: MVP.md, PEDAGOGY.md, LEARNER_JOURNEY.md (issue #8
decisions D1-D8), PRODUCT_INTENT.md. Requirements: `.agora/intents/issue-10/REQUIREMENTS.md`
(R1-R10). Formal accessibility certification is explicitly out of scope for the POC.

Each item below is a discrete, checkable assertion — written so a reviewer or a
Playwright/a11y test can evaluate it directly, pass or fail.

## 1. Keyboard access to Run/Stop/Reset (R1)

- [ ] Run, Stop and Reset are each reachable via Tab in a logical order.
- [ ] Each is activatable via Enter or Space when focused.
- [ ] No control requires a mouse-only gesture (hover-to-reveal, drag) to activate.

## 2. Visible focus (R2)

- [ ] Every interactive control (Run/Stop/Reset, toolbox blocks, workspace blocks,
  tutor panel controls) shows a visible focus outline when focused via keyboard.
- [ ] The focus indicator meets WCAG 2.2 non-text contrast: at least 3:1 against
  adjacent colors.
- [ ] Focus is never suppressed with `outline: none` without a replacement indicator.

## 3. Non-color-only status (R3)

- [ ] Run state (idle/running) is shown via a label or icon change, not color alone.
- [ ] Success state includes text/icon, not just a color shift on the stage.
- [ ] Error/retry states (per CONTENT_GUIDE.md) include an icon or label, not a
  color-only cue.

## 4. Contrast (R4)

- [ ] Body text and UI labels meet WCAG AA: at least 4.5:1 contrast against their
  background.
- [ ] Large text (≥24px or ≥19px bold) and icons meet at least 3:1.
- [ ] Code-panel text meets the same 4.5:1 minimum (see §9).

## 5. Interactive target sizing (R5)

- [ ] Run, Stop and Reset controls are each at least 44x44 CSS px.
- [ ] Toolbox blocks (drag source) are each at least 44x44 CSS px in their touch
  target, consistent with MVP.md's touch-capable requirement.

## 6. Drag alternatives / limitations (R6)

- [ ] Document whether placing a block from the toolbox into the workspace has a
  non-drag alternative (e.g., click-to-select-then-click-to-place, or keyboard
  insertion).
- [ ] If Blockly's current integration provides no non-drag alternative, that is
  recorded here as a known POC limitation, not silently omitted:
  **Known limitation**: stock Blockly drag-and-drop block placement has no built-in
  keyboard-only alternative; this is accepted for the POC and flagged for post-POC
  follow-up.

## 7. Reduced motion (R7)

- [ ] When `prefers-reduced-motion: reduce` is set, block-snap animations, panel
  transitions and any decorative motion are disabled or reduced to near-instant.
- [ ] Functional feedback (success state, error state, run/stop state change) still
  appears — only decorative motion is affected.

## 8. Screen-reader labels where Blockly permits (R8)

- [ ] Toolbox blocks expose an accessible name via Blockly's supported ARIA/label
  mechanism (e.g. `move steps`, `turn`, `repeat N`, `if condition`, `when run
  starts`, `touching goal?`).
- [ ] Run, Stop, Reset and the mission panel expose accessible names/roles.
- **Known limitation**: the block-composition canvas itself (spatial arrangement of
  connected blocks) is not fully screen-reader navigable in stock Blockly; this is
  recorded as a POC limitation rather than claimed as covered.

## 9. Code-panel readability (R9)

- [ ] The generated-code panel uses a minimum 14px monospace font.
- [ ] Code-panel text meets the §4 contrast requirement (4.5:1).
- [ ] Per LEARNER_JOURNEY.md D2, the code panel never scrolls out of the editor
  viewport at any supported width; only its internal content scrolls for long
  programs.
- [ ] In the stacked (narrow) layout, the code band keeps its 240px minimum visible
  height (LEARNER_JOURNEY.md D2).

## 10. Narrow desktop/tablet layout (R10)

- [ ] At the ~768px breakpoint (LEARNER_JOURNEY.md D2), the layout switches from
  side-by-side (60/40 blocks/code, D1) to stacked (blocks above code band).
- [ ] Run/Stop/Reset remain reachable at narrow widths without scrolling the
  workspace away (carried in the header, per LEARNER_JOURNEY.md §2).
- [ ] The stacked code band keeps its 240px minimum height (same assertion as §9,
  checked at narrow width specifically).

## Out of scope

Formal accessibility certification (e.g., VPAT, third-party audit) is explicitly not
required for this POC (issue #10 non-goal).
