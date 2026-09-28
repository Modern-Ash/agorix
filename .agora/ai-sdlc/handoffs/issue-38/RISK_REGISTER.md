# Risk Register

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Studio creates a second canonical model | High | Use shared `@agorix/program-model` and persistence contracts only. |
| VS Code API leaks into domain packages | High | Isolate imports to extension entry/adapters and test pure modules separately. |
| #38 tries to absorb #121 | High | Produce fixtures/handoff now; leave full Web reopen proof to #121. |
| ProgramProposal applies silently | High | Require explicit apply tests and reject/no-mutation tests. |
| Extension packaging becomes too broad | Medium | First slice builds locally; marketplace packaging can follow separately. |
| Remote AI provider becomes required | Medium | Use deterministic/local proposal fixtures for first slice. |
| UI looks like embedded Scratch | Medium | Follow #117 IDE-density Studio guidance and textual-code-first direction. |
