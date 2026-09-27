# ADR 0003: Product i18n/l10n foundation

## Status

Accepted for the #110 multilingual product slice.

## Context

Agorix teaches children through UI copy, curriculum prompts, runtime feedback and Learning Companion hints. Those learner-facing surfaces must be available in more than one human language while the canonical program, runtime state, AST, generated code and provider-neutral structured AI fields remain locale-independent.

The current product slice is a React/Vite POC with TypeScript packages for curriculum, persistence, runtime and tutor contracts. Adding a large i18n dependency before plural-heavy content exists would create dependency and lockfile churn, but hand-scattered strings would make future language packs unsafe.

## Decision

Use typed message catalogs and an explicit locale registry for the current POC slice. Supported product locales are `en` and `es`; `en` is the deterministic fallback. Locale is stored as presentation metadata and is never stored inside the canonical program.

Keep the catalog API intentionally small: `resolveLocale`, `t`, and catalog completeness assertions. Curriculum and tutor packages expose locale-aware helpers while preserving stable mission IDs, concepts, program schema and response structure.

FormatJS/react-intl remains the preferred migration path when Agorix needs ICU plural rules, extraction tooling, translator workflows or runtime loading. The current catalog structure is designed so that migration can preserve keys and tests rather than re-discovering strings.

## Rationale

- The POC has simple messages and no plural-rich grammar yet.
- Typed catalogs give immediate missing-key diagnostics without adding a dependency.
- Locale fallback, supported-locale registry and metadata-only persistence are testable now.
- Keeping locale outside canonical program data protects semantic hashes and future programming-language projections.
- Future language packs can build on the same registry and completeness tests.

## Consequences

- Core learner-facing UI strings for the current app live in localization resources.
- First Mission and deterministic tutor responses resolve in English and Spanish.
- Unsupported locales fall back to English deterministically.
- Future ICU/plural needs should trigger a revisit of this ADR and likely adoption of FormatJS/react-intl.
