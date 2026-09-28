# Domain Model - issue #77

`LearnerTraceItem` is a presentation-safe view over deterministic `ExecutionStep` facts. It includes canonical node id, runtime step, before/after state, delta, condition result, optional iteration label, outcome and profile (`beginner` or `studio`).
