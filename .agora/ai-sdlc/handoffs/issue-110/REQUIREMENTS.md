## Functional Requirements

- FR-001: The application exposes English and Spanish as selectable product locales.
- FR-002: Locale switching updates learner-facing UI text without restarting the mission.
- FR-003: Locale preference is stored separately from canonical program/runtime state.
- FR-004: Switching locale preserves canonical program hash and semantics.
- FR-005: The First Mission is fully available in English and Spanish.
- FR-006: Run, Step, Stop, Reset, proposal review, and execution evidence labels are localized.
- FR-007: Deterministic fake Learning Companion output is available in English and Spanish.
- FR-008: Real-provider Learning Companion requests include locale explicitly.
- FR-009: AI structured fields that are consumed by code remain locale-independent.
- FR-010: Safety-critical learner copy exists in English and Spanish.
- FR-011: Core learner-facing strings live in localization resources rather than scattered hard-coded UI literals.
- FR-012: Fallback from unsupported or incomplete locales is deterministic and tested.
- FR-013: Missing translations fail CI or emit an explicit developer diagnostic covered by tests.
- FR-014: Adding a third locale can be done by adding registry/catalog entries without changing canonical program/runtime code.
- FR-015: README.md and README.es.md present equivalent product information.

## Documentation Requirements

- DR-001: Add an i18n ADR that documents evaluated options and the selected message format/library.
- DR-002: Add contributor guidance for translation keys, catalog completeness, fallback rules, and safety-copy review expectations.
- DR-003: Capture implementation evidence for English and Spanish, including screenshots or equivalent UI evidence and a hash/state comparison.
