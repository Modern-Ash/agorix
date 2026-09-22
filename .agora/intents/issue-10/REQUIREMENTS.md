---
schema: "agora/requirements/v1"
id: "issue-10-ux-requirements"
intent: "issue-10"
work: "issue-10-delivery/ux-requirements"
source: "https://github.com/Modern-Ash/agorix/issues/10"
---

# Requirements: Issue #10 UX/accessibility requirements

Each requirement is phrased as a discrete, checkable assertion so a reviewer or a
Playwright/a11y test can evaluate it directly (per clarifications.md).

## R1 — Keyboard access

Run, Stop and Reset are each reachable and activatable via keyboard alone (Tab to
focus, Enter/Space to activate), with no mouse-only path.

## R2 — Visible focus

Every interactive control (Run/Stop/Reset, toolbox blocks, workspace blocks, tutor
panel controls) shows a visible focus indicator meeting WCAG 2.2 non-text contrast
(3:1 against adjacent colors) when focused via keyboard.

## R3 — Non-color-only status

Run state, success and error states are each conveyed by an icon, label or text
change in addition to color (no state distinguishable by hue alone).

## R4 — Contrast

Body text and code-panel text meet WCAG AA contrast (4.5:1); large text and icons
meet 3:1.

## R5 — Target sizing

Primary interactive targets (Run/Stop/Reset, toolbox blocks) are at least 44x44 CSS
px, consistent with MVP.md's touch-capable requirement.

## R6 — Drag alternatives / limitations

Document explicitly whether block placement has a non-drag (keyboard/click-based)
alternative; where Blockly does not support one, state that as a known POC
limitation rather than omitting it.

## R7 — Reduced motion

When the OS/browser `prefers-reduced-motion` is set, non-essential animation
(transitions, block-snap effects) is disabled or reduced; functional feedback
(success state, error state) still appears.

## R8 — Screen-reader labels

Toolbox blocks, Run/Stop/Reset, and the mission panel expose accessible names via
Blockly's supported ARIA/label mechanisms; any workspace-canvas element Blockly
cannot label is listed as a known limitation (R6-style documentation).

## R9 — Code-panel readability

The generated-code panel uses a minimum 14px monospace font, meets the R4 contrast
requirement, and — per LEARNER_JOURNEY.md D2 — never scrolls out of the viewport;
only its internal content scrolls for long programs.

## R10 — Narrow desktop/tablet layout

At the ~768px breakpoint (LEARNER_JOURNEY.md D2), the layout stacks blocks above the
code band; the code band keeps a 240px minimum visible height; Run/Stop/Reset stay
reachable without scrolling the workspace away.

## Traceability

R1-R10 map 1:1 to issue #10's ten listed categories. Evidence of satisfaction is the
published `UX_REQUIREMENTS.md` plus product-owner review sign-off; formal
certification is explicitly out of scope (POC non-goal).
