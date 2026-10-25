# Ori educator pilot — protocol and reproducible synthetic rehearsal

## Objective

Compare Ori's pedagogical hints with the deterministic Agorix tutor across five Scratch-inspired programming topics: movement, sequences, loops, events and debugging. This is an educator-only evaluation; children do not participate.

## Phase 0 — synthetic rehearsal

From `apps/tutor-api` after `pnpm build`:

```bash
node scripts/ori-educator-pilot-fixture.mjs ./synthetic-pilot.json
node scripts/ori-educator-report.mjs ./synthetic-pilot.json ./synthetic-report.json
```

The generator produces five complete synthetic A/B pairs with one fictional reviewer and uniform scores. This proves only the reporting pipeline. **It does not produce real pedagogical evidence or actual Ori responses.**

CI runs `node scripts/ori-educator-pilot-smoke.mjs` after the build to verify five fixtures, five paired reviews, and redaction of restricted source keys and reviewer IDs.

## Phase 1 — human educator pilot

1. Recruit at least three independent educators familiar with children's introductory programming; record their expertise without collecting unnecessary personal information.
2. Present five scenarios and blinded A/B hints. Both hints must correspond to the same mission and hint level. Counterbalance A/B ordering across reviewers.
3. Score clarity, learner agency, scaffolding, context relevance and age appropriateness from 1 to 5. Require a qualitative rationale for each response and flag unsafe or inappropriate content.
4. Collect ratings offline in a restricted file. Keep the tutor-source mapping separate from raters and reveal it only after all ratings are submitted.
5. Generate a report using the CLI. Review paired differences, disagreements, safety flags and qualitative observations.
6. Do not enable Ori for Kids unless a separate safety and pedagogical release review explicitly approves it.

## Proposed decision criteria (to be validated before the pilot)

- 100% of submissions pass schema and completeness validation.
- No unresolved unsafe-content flags; any flag triggers review and blocks learner rollout.
- At least three independent educator assessments per fixture.
- Examine per-dimension performance and disagreements; an overall average alone cannot justify rollout.
- Document qualitative issues and required improvements before a controlled learner-facing test.

## Limitations

This protocol does not claim statistical significance or demonstrated learning outcomes. The current code does not collect educator ratings or enforce independence of human reviewers. Pilot data must not contain child identifiers, programs or sensitive information. The resulting report is a decision-support artifact, not a substitute for ethical review or safeguards.

## Material para educadores

- [Guía de evaluación y rúbrica en español](./ORI_EDUCATOR_REVIEW_PACK.md)
- [Planilla ciega A/B imprimible](./ORI_EDUCATOR_RATING_SHEET.md)

Estos documentos son materiales de evaluación humana; no constituyen evidencia de que el piloto ya se haya realizado.
