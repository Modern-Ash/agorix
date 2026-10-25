# Shared pedagogical context — experimental synthetic contract

This increment introduces a strict, versioned, synthetic-only context representation derived from canonical Kids starter programs.

Fields: schema version, canonical mission ID/index, hint level, script count, SHA-256 program fingerprint and actual deterministic rule outcome kind.

## Purpose

Make evaluation metadata reproducible and explicit, without exporting learner identities, source code, private prompts or full programs. The context is computed from the existing Kids curriculum and deterministic baseline; callers cannot supply arbitrary mission IDs.

## Critical boundaries

- **This is not the current Ori /v1/plan wire contract.** That endpoint still accepts only mission index, hint level and script count. No new API or transport is registered here.
- A SHA-256 digest is a provenance/reproducibility marker, not a substitute for the actual program context.
- The `deterministicKind` field is evidence of Agorix's rule output, not a neutral feature that both tutors should necessarily receive. It must not be passed to Ori as an answer leak in a blind A/B evaluation.
- The five Scratch-inspired evaluation fixtures still do not map one-to-one to the three canonical Kids missions.
- This contract does not establish equivalent inputs, learning effectiveness or child safety.

## Next gate

Separate neutral shared inputs from tutor-specific evidence; build an explicit alignment matrix for the canonical missions and evaluate which pedagogical questions are legitimately comparable. Only after this should a transport or real A/B capture be designed.

No Kids API, UI, production flag or stable branch is changed.
