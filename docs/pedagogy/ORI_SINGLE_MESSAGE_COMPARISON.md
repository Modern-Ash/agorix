# Ori vs Agorix — exploratory single-message comparison

This increment prepares a one-message A/B presentation from two real text-generating components:

- Agorix `createDeterministicTutorResponse`: returns `TutorResponse.message` from a validated program, mission, runtime and hint history.
- Ori `createOriLearnerHintPreview`: returns `hint` from a validated Ori shadow plan generated with mission index, hint level and script count.

The comparison does not fabricate a `nextStep` for Agorix or include Ori's second step. The returned provenance mapping must be withheld from educators; only A/B text may be shown in a blind review.

## Methodological caveat

The underlying inputs are **not equivalent**. Ori's shadow API does not see the full program/runtime available to the deterministic tutor. This comparison is exploratory and can assess how educators perceive each text, but **cannot support an efficacy claim** about one tutor being better under equal conditions.

The output explicitly sets `equalInputContextProven: false` and `eligibleForEfficacyClaim: false`. The caller must preserve these flags in any analysis or report.

This is an in-memory helper, not a CLI, API or Kids feature. It does not authenticate provenance, call providers, or collect ratings. A future release should bind both actual producer calls to a documented synthetic scenario and keep source keys separately restricted.
