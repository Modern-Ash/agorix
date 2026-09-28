## Measurement Criteria

- MC-001: A test or screenshot evidence shows English and Spanish are selectable in the app.
- MC-002: A deterministic test captures the same canonical program hash before and after locale switching.
- MC-003: Unit tests prove First Mission content resolves fully in English and Spanish.
- MC-004: Component/e2e tests cover localized Run, Step, Stop, Reset, proposal review, and execution evidence labels.
- MC-005: Tutor contract tests cover deterministic fake Learning Companion responses in English and Spanish.
- MC-006: Provider request tests or contract assertions prove locale is sent explicitly.
- MC-007: Tests or type-level checks prove machine-readable structured AI fields remain locale-independent.
- MC-008: Safety-copy catalog checks prove required safety strings exist in both locales.
- MC-009: A hard-coded-string audit or targeted tests confirm core learner-facing UI strings moved to localization resources.
- MC-010: Fallback tests prove unsupported/incomplete locales resolve deterministically.
- MC-011: Missing-key tests prove CI failure or explicit developer diagnostics.
- MC-012: A fixture or test-only pseudo/third locale demonstrates extensibility without runtime/canonical code changes.
- MC-013: Documentation review confirms README.md and README.es.md carry equivalent product information.
- MC-014: Repository verification passes with the selected commands, expected to include `pnpm test`, `pnpm build`, and available lint/format checks.
