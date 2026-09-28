# Issue 85 Risk Register

| Risk | Impact | Mitigation | Owner |
| --- | --- | --- | --- |
| Legacy `Tutor*` consumers break during naming migration. | Web and tutor-api tests fail or require unrelated changes. | Add Learning Companion exports alongside compatibility helpers first. | Developer |
| Contract grows into provider runtime concerns. | Duplicates #92 and couples domain package to adapters. | Keep provider configuration and transport out of package scope. | Developer |
| Builder proposal looks like accepted program state. | Learner authorship boundary becomes ambiguous. | Use explicit proposal payload, proposal ids/status and no accepted-state field. | Developer |
| Debugger invents facts or mixes evidence with advice. | Product violates "Runtime proves." | Separate observed facts/evidence references from suggestions in type model and tests. | Developer |
| Validation becomes too loose. | Provider-specific or malformed output leaks to UI. | Unknown keys fail, required capability fields validated, malformed tests added. | Developer |
| Contract requires child PII for personalization. | Privacy/safety violation. | Keep data-minimized context and tests asserting no required identity fields. | Developer |
| Fake implementation over-promises capability quality. | Later UI depends on unrealistic behavior. | Document deterministic fake as conformance support, not model intelligence. | Developer |
