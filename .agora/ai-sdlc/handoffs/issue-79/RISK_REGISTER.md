# Risk Register - issue #79

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Contract overfits current TypeScript-like code generator | Future Agorix Code/Python work becomes awkward | Include two independent test projections and language-neutral mapping names. |
| Mapping ranges become inconsistent across languages | Highlighting/comparison breaks | Define half-open text ranges and conformance helper assertions. |
| Unsupported nodes render partial code | Learner sees misleading output | Require structured diagnostics and/or explicit unsupported errors. |
| Registry couples projections to UI | Studio/Web reuse becomes harder | Keep registry in shared package with simple metadata and no UI imports. |
| Scope expands into implementing #80/#81/#82 | Slows contract delivery | Deliver interfaces, adapter path and tests only. |
