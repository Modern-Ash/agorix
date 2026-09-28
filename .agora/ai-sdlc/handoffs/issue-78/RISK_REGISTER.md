# Risk Register - issue #78

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Proposal harness accidentally mutates program during preview | Violates transparency invariant | Assert persisted canonical program/hash before and after preview/reject. |
| E2E becomes flaky | CI instability | Use role selectors and deterministic local state, no sleeps. |
| Tablet coverage misses orientation state | Regression escapes | Run portrait and landscape variants plus viewport change in-flow. |
