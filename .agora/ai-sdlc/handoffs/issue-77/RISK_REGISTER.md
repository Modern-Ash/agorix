# Risk Register - issue #77

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Child trace exposes raw engine details | Learner confusion or privacy leak | Add presentation profile boundary and privacy tests. |
| Beginner and Studio traces diverge semantically | Cross-surface mismatch | Generate both profiles from the same deterministic trace items. |
| Repeat/condition traces become noisy | Learner cannot follow causality | Compress labels and expose iteration/condition facts only when useful. |
| Localization is bypassed | Non-English surfaces regress | Use existing i18n keys for Web rendering. |
