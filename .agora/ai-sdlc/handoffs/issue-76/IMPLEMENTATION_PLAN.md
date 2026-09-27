# Implementation Plan - issue #76

1. Add `ExecutionStep` and `executionStepsFromRuntimeObservations` to `@agorix/stage`.
2. Export the shared contract and add package-local Vitest config for focused verification.
3. Update Web Step behavior to reuse the shared sequence, clear stale cursor state on edit/reset and disable Step during Run.
4. Update Studio execution evidence to expose the same sequence.
5. Add unit and Playwright evidence for simple stepping, repeat/condition timing, Studio/Web parity, touch controls and orientation persistence.
