# Risk Register

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Touch-only support is claimed but still relies on drag | High | Add Playwright no-drag path covering First Mission editing. |
| Reorder controls are too small or unclear | Medium | Enforce touch target checks and explicit labels. |
| Action Palette obscures World/Code context | Medium | Test tablet layout with palette visible and primary surfaces available. |
| Virtual keyboard hides numeric edit controls | Medium | Test mobile/tablet viewport focused on numeric input and visible related controls. |
| Spanish labels overflow controls | Medium | Include Spanish interaction test and wrapping-safe controls. |
| Stylus scope expands into freehand-to-code | Medium | Document stylus as future-compatible only; keep freehand generation out of scope. |
| Changes regress #118 shell | High | Preserve existing tablet landscape/portrait tests and add focused interaction coverage. |
