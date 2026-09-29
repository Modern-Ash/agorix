## Risk Register

- R-001: Scope creep across future Studio/Worlds surfaces.
  - Mitigation: implement current product slice and document future contracts without inventing unavailable screens.

- R-002: Translations drift from child-safety intent.
  - Mitigation: treat safety copy as required catalog entries and include review notes/tests for both locales.

- R-003: Locale accidentally changes canonical program semantics.
  - Mitigation: persist locale as presentation metadata only and add hash/state invariance tests.

- R-004: Hard-coded strings remain in learner-facing UI.
  - Mitigation: use a targeted audit plus component/e2e assertions for current core surfaces.

- R-005: Spanish text causes layout overflow.
  - Mitigation: verify responsive layouts and add screenshot evidence for both locales.

- R-006: Missing-key behavior is too quiet for contributors.
  - Mitigation: fail tests/CI or emit explicit diagnostics with coverage.

- R-007: Dependency choice becomes disproportionate for the current POC.
  - Mitigation: record the decision in ADR with criteria and keep the public i18n contract stable.

- R-008: README equivalence becomes subjective.
  - Mitigation: update both READMEs in the same PR and document equivalent sections rather than requiring word-for-word parity.
