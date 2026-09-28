# Risk Register - issue #76

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Step reuses animation frames without an explicit canonical contract | Web and Studio can drift | Add a shared runtime Step view model derived from observations and test Web/Studio parity. |
| Loops and condition containers are counted in a way that feels meaningless to children | Learner causality is confusing | Document timing and include repeat/conditional tests for the exact sequence. |
| Run and Step share mutable timers/cursors | Race conditions or stale highlights | Clear timers before Step, disable Step during Run, and reset step state on edits/reset. |
| Highlighting uses block indexes while runtime uses canonical node ids | Block/code highlights can diverge | Drive both block and code highlight from the same canonical node id. |
| Narrow/tablet layout hides or shrinks Step | Touch acceptance fails | Add CSS/test evidence for first-class Step in compact controls. |
