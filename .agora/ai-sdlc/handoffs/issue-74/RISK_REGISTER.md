# Risk Register - issue #74

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Contract becomes too abstract for implementation | #75-#78 cannot use it directly | Include explicit mutation paths, flows and Playwright assertions |
| Tablet and Studio diverge semantically | Cross-surface product fork | Define shared semantics first, then map affordances per surface |
| Beginner UX exposes too much diagnostic detail | Cognitive overload | Separate compact child-facing trace from deeper Studio inspector detail |
| AI proposal styling implies correctness | Learner overtrust | Use provisional labels, uncertainty copy and accept/modify/reject controls |
| Runtime evidence is blurred with AI explanation | Product authority confusion | ADR states runtime is authority; AI can explain only observed facts |
| Narrow viewport hides code | Violates source-of-truth journey | Explicit portrait/landscape/desktop code visibility rules |
