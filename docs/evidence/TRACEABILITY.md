# Agorix MVP traceability

Evidence snapshot: 2026-09-30.

## Product acceptance chain

| Product invariant / capability | Primary issue evidence | Status |
| --- | --- | --- |
| AI-native product/pedagogy | #63 / #69–#73 | complete |
| Transparent proposal authority | #64 / #74–#78 / #87 | complete |
| Deterministic runtime evidence | #76–#78 / #88 | complete |
| First Mission learner loop | #91 | complete |
| AI-literacy wrong-suggestion journey | #104 | complete |
| Learning Companion | #66 / #85–#90 | complete |
| System-0 + Laya Decision Plane | #160–#162 / #171 | complete |
| Provider-neutral routing/conformance | #67 / #92–#97 | complete |
| Multi-language projection | #65 / #79–#84 | complete |
| Web/Tablet/PWA | #36 / #117–#120 | complete |
| Agorix Studio first slice | #38 | complete |
| Web/Studio semantic compatibility | #121 | complete |
| Safety/privacy | #30 / #99–#103 | complete |

## North-star evidence

The #104 E2E is the release-acceptance learner scenario:

```text
learner state
 -> visible AI suggestion
 -> explicit prediction
 -> learner acceptance
 -> deterministic failure evidence
 -> evidence-grounded assistance
 -> learner correction
 -> deterministic success
 -> reflection
```

It fails if the learner can passively accept before prediction, if proposal state is confused with
runtime fact, or if the corrected program is not learner-approved canonical state.

## Representation authority

All learner-visible code representations are deterministic projections of one canonical program:

```text
Canonical Program
  -> Blocks
  -> Agorix Code
  -> Python
  -> TypeScript
  -> optional LanguagePacks
```

Projected source is not an independent executed authority.

## Provider evidence

See `docs/evidence/PROVIDER_MATRIX.md`.

The matrix verifies adapter/contract behavior in CI. It does not claim equivalent pedagogical
quality among models.

## Agora AI-SDLC experiment status

Product traceability is complete enough for Agorix MVP acceptance.

The broader Agora framework experiment is intentionally separate:

- #33 multi-agent delivery matrix: pending/open;
- #34 provenance/review-separation/metrics evidence: pending/open;
- #7 framework-validation epic: remains open until those experiments are reconciled.

Therefore this document does **not** claim completed producer/reviewer separation or multi-agent
coverage where no committed evidence exists.

## Deferred product extensions

- #37 native packaging evaluation;
- #98 deployment/self-hosting documentation;
- #101 advanced model-comparison activity.

They are not dependencies of the completed MVP learner loop.
