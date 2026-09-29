# Risk Register - Issue #72

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Old "AI tutor" language survives as product authority | Agents may implement chat help instead of transparent proposal/decision/evidence flow | Supersede tutor terminology and define learning companion as product capability |
| Provider output is treated as executable code | Hidden generated solutions could bypass learner decision and validation | State provider output is proposal data only, validated before preview and learner acceptance |
| Runtime and AI explanation paths blur | AI claims could replace deterministic evidence | Separate runtime evidence interface from learning-companion explanation/debugging |
| Domain contracts import UI/provider concerns | Product becomes hard to reuse and provider-dependent | Keep domain packages UI/provider independent and require adapters |
| Architecture review is skipped | Acceptance evidence incomplete | Record explicit architecture review evidence before Operations |
