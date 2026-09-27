# Level 1 Plan - issue #76

1. Define a deterministic Step contract over canonical runtime observations so Web and Studio consume the same ordered sequence.
2. Ensure each Step exposes the current canonical node id, statement type, world before/after state and matching observation frame.
3. Document child-understandable stepping timing for simple statements, repeats, condition evaluation and completion.
4. Update Web Step behavior so Step cannot race with Run, editing stops/clears stepped execution, Reset restores initial stage and cursor, and orientation/viewport changes keep step state.
5. Keep block highlighting and active code range highlighting synchronized from the same canonical node id.
6. Extend Studio evidence so Execution Inspector and Web Step share the same canonical step sequence.
7. Add unit/component/e2e coverage for simple, repeat and conditional stepping plus touch/narrow layout controls.
8. Run repository verification and record Agora evidence.

Approval-state: `pending` until Product Owner and developer approvals are recorded for this inception revision.
