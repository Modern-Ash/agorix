# Logical design — issue #110

- `packages/curriculum` owns supported locale normalization, localized First Mission resources and localized runtime feedback.
- `packages/tutor-contract` consumes `reading.locale` to produce deterministic fake tutor copy in the selected product language.
- `apps/web/src/i18n.ts` owns UI message catalogs, labels, fallback and completeness checks.
- `apps/web/src/App.tsx` owns the locale selector and passes locale into mission feedback and tutor requests.
- `packages/persistence` stores optional `metadata.locale`, keeping canonical `program` unchanged.
