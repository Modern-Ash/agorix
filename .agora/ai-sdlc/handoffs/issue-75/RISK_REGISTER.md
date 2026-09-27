# Risk Register - issue #75

| Risk | Impact | Mitigation |
| --- | --- | --- |
| #87 protocol later differs | Rework proposal protocol | Keep #75 v1 bounded, explicitly compatible with #87 fields, and document remaining breadth |
| Full AST patching becomes too broad | Hidden mutation or unsafe operations | Support a narrow initial operation set and fail unknown operations closed |
| Studio keeps separate semantics | Cross-surface fork | Move shared decision logic into platform-neutral package and make Studio consume it |
| Web proposal card becomes UI-heavy | Scope creep | Build view-model/actions and tests; leave detailed visual polish to later UI work |
| Stale proposal applies after learner edits | Silent overwrite | Require base semantic hash match before accept/modify apply |
| Provider prose drives diff | Non-deterministic/unsafe preview | Derive diff only from accepted/candidate canonical programs |
| Audit record leaks PII/provider internals | Safety/privacy issue | Validate serializable provider-neutral audit fields only |
