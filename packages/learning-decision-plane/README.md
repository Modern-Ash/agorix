# @agorix/learning-decision-plane

Provider-neutral pedagogical decision layer for Agorix.

```text
LearningCompanion interaction
  -> System-0 deterministic pedagogical/safety floors
  -> optional System-1 advisory decisions
  -> LearningRequirements
  -> deterministic response or provider-runtime selection
```

This package does **not** depend on Laya or any model/provider adapter. Issue #161 supplies the Laya adapter; issue #162 integrates the resulting requirements with provider selection.

## Authority

The Decision Plane may classify bounded pedagogical needs. It cannot:

- mutate the canonical program;
- apply a ProgramProposal;
- decide mission completion;
- manufacture runtime evidence;
- select a provider/model by name;
- raise assistance or solution allowance above deterministic policy;
- bypass LearningCompanion safety validation.

Low-confidence advisory answers are ignored in favor of safe deterministic/fallback requirements.
