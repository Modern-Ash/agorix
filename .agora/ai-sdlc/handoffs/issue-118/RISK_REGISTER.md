# Risk Register

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Refactor breaks existing runtime/tutor behavior | High | Preserve existing state handlers; add regression tests around run, hints and code mapping. |
| Tablet shell passes visually but hides Code below too much chrome | High | Playwright assertions for World and Code visibility in target tablet viewports. |
| Action Palette replacement reduces block discoverability | Medium | Keep palette visible/contextual by default and label it clearly; preserve keyboard and touch activation. |
| Spanish labels overflow compact controls | Medium | Test/wrap labels and avoid fixed-height critical controls. |
| Virtual keyboard covers numeric block editing controls | Medium | Use scrollable primary regions and avoid fixed bottom controls that cover form inputs. |
| CSS refactor causes broad visual churn | Medium | Scope changes to `apps/web` shell and use #117 tokens to make review intentional. |
| Orientation preservation is confused with persistence | Medium | Test state continuity by viewport resize without reload, then rely on existing persistence tests for reload behavior. |
| Safe-area handling is missed | Low | Add `env(safe-area-inset-*)` padding to shell/chrome rules. |
