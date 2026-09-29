<!-- agora-ai-sdlc:deterministic-inception/v1 -->

# Risk Register — issue-96

| Risk | Impact if unmitigated | Mitigation |
| --- | --- | --- |
| Selection silently falls back to an incompatible provider | Broken/garbled AI responses | `selectProviderRuntime` only selects a runtime whose `negotiateCapability` reports supported |
| No compatible provider crashes the app or fakes a response | Broken learner experience, false AI claim | Explicit `unavailable` outcome with reason; UI must show it, never synthesize a response |
| Offline mode accidentally calls network | Privacy/safety and "no fake claim" NFR violation | `offline: true` short-circuits before any runtime is touched, verified by table-driven tests |
| Unavailable-copy leaks provider/runtime names to children | Breaks age-appropriate, jargon-free copy requirement | `describeProviderUnavailableForLearner` is a separate function from developer diagnostics, tested for absence of provider/runtime terms |
| Health probe hang/throw blocks selection | App appears frozen | `checkProviderRuntimeHealth` treats a throwing health check as `unavailable` rather than propagating |
