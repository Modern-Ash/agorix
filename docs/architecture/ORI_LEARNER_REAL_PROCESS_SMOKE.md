# Ori learner hint preview — real process interoperability

This increment extends the existing cross-repository smoke to exercise `createOriLearnerHintPreview` against the **real Ori reference HTTP process** in `Modern-Ash/ori`, not only a mocked consumer.

## Assertions

- Disabled-by-default preview returns unavailable without exposing a plan.
- Explicitly enabled preview returns only the pedagogical hint and first learning step.
- The hint and step match the independently validated Ori plan for the same mission and hint level.
- `requiresLearnerApproval` is true; `appliedChanges` is false.
- No full plan, source code, executable proposal or child identifier is returned.

## Boundaries

The smoke uses synthetic metadata and the existing private cross-repository CI checkout. It does not assess whether the text is age-appropriate, contextually helpful, accessible or educationally effective. No child-facing API or UI is enabled.

Before learner rollout, require an educator-reviewed evaluation corpus, safety/content filtering, learner-facing deterministic fallback and human approval of the rollout. CI must include the real Ori process job as well as formatting, lint, TypeScript, unit tests and build.
