# Domain model — issue #110

## Locale

`Locale` is a product presentation preference. Supported locales are `en` and `es`; unsupported locale tags fall back deterministically to `en` after language normalization. Locale may be persisted in project metadata but must not enter canonical program data.

## Localized mission

The First Mission keeps stable schema, ID, version, starter project, starter stage, completion predicate and concepts. Localized fields are title, learner-facing goal, constraints, hint ladder and reflection prompt.

## Localized tutor

Tutor requests carry locale through `reading.locale`. Tutor responses may localize `message`; structured fields such as schema, hintLevel, nodeIds and concepts remain locale-independent.

## UI catalog

The web app owns learner-facing UI messages through a typed catalog. Missing keys are checked by tests.
