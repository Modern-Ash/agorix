# Ori canonical execution port

This server-only adapter executes a validated Agorix program using `runProgram` and `createWorldState`, with an explicit 1–100 step budget. It returns the canonical RunResult to the existing persisted evidence resolver, which minimizes trace fields and rejects incomplete runs.

The initial world must come from trusted canonical project/mission state, never from browser-controlled request data. The adapter does not expose raw traces to Ori directly and does not mutate persisted programs.

Next integration: wire this execution port and project repository into the authorized Ori project review service; supply verified learner attempts/hints and authenticated ownership, then add end-to-end tests. No public endpoint or automatic program changes are included. Agorix base branch `integration/ori`.
