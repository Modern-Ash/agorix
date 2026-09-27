## Level 1 Plan

1. Establish i18n architecture
   - Add an ADR that compares mature i18n options and records the selected message format/library.
   - Define supported locales, default locale, fallback behavior, missing-translation diagnostics, and contributor workflow.
   - Keep product locale independent from canonical program state and programming projection.

2. Localize learner-facing resources
   - Move current core UI strings into English and Spanish catalogs.
   - Localize First Mission title, goals, prompts, hints, feedback, and reflection prompt.
   - Include safety-critical learner copy in both locales.

3. Propagate locale through the Learning Companion
   - Ensure deterministic fake tutor responses work in English and Spanish.
   - Ensure real-provider request context carries locale explicitly.
   - Keep structured AI fields locale-independent where they are machine-readable.

4. Preserve canonical semantics during locale switching
   - Persist locale as presentation preference only.
   - Prove locale switching does not change program hash, canonical code, runtime evidence shape, or mission progress.

5. Verify and document the product slice
   - Add unit/component/e2e tests for selection, fallback, catalogs, curriculum, companion locale behavior, and missing keys.
   - Update README.md and README.es.md so product information remains equivalent.
   - Add contributor translation guidance and screenshot/evidence capture for English and Spanish journeys.

## Execution shape

The work should be built as one cohesive issue delivery, but decomposed internally into five units: foundation, curriculum, web UI, Learning Companion, and verification/docs. This avoids a high-risk all-at-once edit while keeping #110 deliverable as one product capability.
