# Measurement Criteria

- MC-001: In Playwright at 1024x768 and 1180x820, World and Code are visible without opening a tab or advanced mode.
- MC-002: In Playwright at 768x1024 and 820x1180, World appears before Code and Code remains visible/inspectable in normal scroll order.
- MC-003: A test confirms there is no permanent major-width left toolbox in tablet landscape; block insertion is available via an Action Palette/bottom sheet.
- MC-004: Run, Stop and Reset controls have bounding boxes at least 44x44 CSS px in tablet tests.
- MC-005: A Playwright flow adds/edits a block, changes viewport orientation, and verifies the generated code still matches the canonical program.
- MC-006: Existing locale-switch test passes and at least one tablet viewport test runs with Spanish UI or verifies layout tolerates localized labels.
- MC-007: Existing deterministic tutor and runtime tests continue to pass after shell refactor.
- MC-008: `pnpm format:check`, unit tests and Playwright coverage pass before PR.
