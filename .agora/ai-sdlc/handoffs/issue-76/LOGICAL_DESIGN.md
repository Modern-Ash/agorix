# Logical Design - issue #76

1. Runtime remains the authority for deterministic execution and observations.
2. `@agorix/stage` maps observations to both visual frames and `ExecutionStep` records.
3. Web prepares a step sequence when Step/Run executes, highlights block and code from `ExecutionStep.nodeId`, and clears stale step state on edit/reset.
4. Studio includes the same `stepSequence` in execution evidence while preserving inspector rows.
5. Playwright validates Web touch/narrow behavior and viewport changes; unit tests validate shared contract and Studio parity.
