# Test Strategy - issue #77

- Stage unit tests validate before/after state, condition result, profile parity and PII/provider exclusion.
- Studio tests validate richer trace state and canonical node parity.
- Web unit/i18n tests validate localized trace labels.
- Playwright validates visible trace correlation and no raw log terms.
- Full checks: format, lint, build, unit, e2e and aisdlc verify.
