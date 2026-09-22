---
schema: "agora/clarifications/v1"
swarm: "issue-10-delivery"
work: "ux-requirements"
created-at: "2026-09-22T20:49:36.657729Z"
last-run-input-sha256: "af0d6a9436ac3658e60feee4bd4ab1776ca8a664b71867f9714253ab1f3b7ee3"
last-run-question-count: 5
last-run-unanswered-count: 0
last-run-by: "project:ai-runtime-2"
last-run-at: "2026-09-22T20:49:36.657729Z"
---

# Clarifications for ux-requirements

| Question | Answer | Actor | Timestamp | Input SHA-256 |
| --- | --- | --- | --- | --- |
| Should docs/product/UX_REQUIREMENTS.md be added to required-artifacts for work item 'ux-requirements' before the inception-approved gate, since it is currently empty despite being the named deliverable? | Yes — add docs/product/UX_REQUIREMENTS.md as a required artifact. | project:ai-runtime-2 | 2026-09-22T20:49:36.657729Z | af0d6a9436ac3658e60feee4bd4ab1776ca8a664b71867f9714253ab1f3b7ee3 |
| Does 'all required categories' in the acceptance criterion mean exactly the 10 items enumerated in issue #10 (keyboard access to Run/Stop/Reset, visible focus, non-color-only status, contrast, target sizing, drag alternatives, reduced-motion, screen-reader labels, code-panel readability, narrow desktop/tablet layout), with no additions or omissions? | Yes — those 10 items define full category coverage; the code-panel font/contrast/scroll sub-requirement is included under code-panel readability. | project:ai-runtime-2 | 2026-09-22T20:49:36.657729Z | af0d6a9436ac3658e60feee4bd4ab1776ca8a664b71867f9714253ab1f3b7ee3 |
| Who holds the 'reviewed' step of the acceptance criterion — is it the product-owner role via the inception-approved gate, or does it also require the AGENTS.md independent-agent-review invariant before this gate? | Product-owner review via the approval on this work item is sufficient for inception-approved; independent-agent-review, if AGENTS.md requires it for merges, happens at PR review time, not as a blocker inside this gate. | project:product-owner | 2026-09-22T20:49:36.657729Z | af0d6a9436ac3658e60feee4bd4ab1776ca8a664b71867f9714253ab1f3b7ee3 |
| What does 'testable' require in practice — must each requirement be phrased as a discrete, automatable assertion (e.g., an explicit Playwright/a11y check statement), or is qualitative/prose guidance acceptable as long as a reviewer can derive checks manually? | Each requirement must be phrased as a discrete, checkable assertion a reviewer or a Playwright/a11y test can evaluate directly (pass/fail), not general prose guidance — per issue #10's "Playwright/a11y issue can derive checks directly." | project:product-owner | 2026-09-22T20:49:36.657729Z | af0d6a9436ac3658e60feee4bd4ab1776ca8a664b71867f9714253ab1f3b7ee3 |
| Should the acceptance-criteria 'stages' field (currently 'none') be populated with explicit verification stages (e.g., draft, categories-covered, Blockly-limitations-documented, reviewed) before requesting the inception-approved gate? | No — use the Method Pack's standard criterion-stages (elaborated, designed, built, verified, deployed, accepted) already defined in ai-sdlc/METHOD.md; no custom stage list needed. | project:product-owner | 2026-09-22T20:49:36.657729Z | af0d6a9436ac3658e60feee4bd4ab1776ca8a664b71867f9714253ab1f3b7ee3 |
