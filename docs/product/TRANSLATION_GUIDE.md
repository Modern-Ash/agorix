# Agorix translation guide

Agorix separates product language from programming semantics. Translate learner-facing product copy, curriculum prompts, feedback and safety guidance; do not translate canonical program data, runtime events, schema names, block type IDs or machine-readable AI response fields.

## Locale registry

The current supported locales are:

- `en` English, fallback locale;
- `es` Spanish.

Unsupported regional tags such as `es-AR` resolve to their language when supported. Unsupported languages fall back to `en`.

## Catalog rules

- Add new learner-facing UI copy through the web catalog.
- Keep catalog keys stable and descriptive by product surface.
- Add every key to every supported locale in the same change.
- Run catalog completeness tests before review.
- Do not place child-facing safety copy in only one language.

## Curriculum rules

Mission IDs, concepts, starter projects, completion predicates and runtime semantics are canonical. Translate mission title, learner-facing goal, hints, feedback and reflection prompts only.

## Learning Companion rules

Provider requests must carry locale explicitly in `reading.locale`. Provider-neutral structured fields such as `hintLevel`, `nodeIds` and `concepts` stay locale-independent so downstream code can rely on them.

## Safety review

Safety-critical copy must preserve meaning across locales, especially copy that limits tutor authority, avoids overclaiming correctness, or explains recovery from errors. If the wording changes materially, ask for Product Owner review before merge.
