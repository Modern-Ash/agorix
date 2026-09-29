# Operational readiness - Issue #70

## Scope

Issue #70 adds `docs/product/LEARNING_PROGRESSION.md`, a source-of-truth product document for concept-based learner progression and adaptive scaffolding.

## Readiness checks

- The document is documentation-only and has no runtime migration.
- `git diff --check -- docs/product/LEARNING_PROGRESSION.md` passes.
- Coverage search confirms the required stages, dimensions and AI-literacy terms are present.
- The document aligns with issue #69's product language: AI proposes, the learner decides, runtime proves and the learner explains.

## Operational impact

- Product and design work for issues #71 and #72 can reference this progression rubric.
- Future curriculum metadata can map missions to stages, concepts, collaboration behavior and required evidence.
- No deployment steps are required beyond merging the documentation PR.

## Reviewer focus

- Confirm the stages are concept-based rather than age-based.
- Confirm each stage includes observable learner behavior.
- Confirm AI responsibility decreases as learner autonomy increases.
- Confirm the rubric does not become a provider-specific prompting course.
