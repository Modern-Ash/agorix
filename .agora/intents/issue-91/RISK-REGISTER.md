<!-- agora-ai-sdlc:deterministic-inception/v1 -->

# Risk Register — issue-91

| Risk | Impact if unmitigated | Mitigation |
| --- | --- | --- |
| CI depends on an external LLM | Flaky/non-reproducible CI | Deterministic fake/offline learning path required for CI; no external LLM call in test suite |
| AI mutates program state invisibly | Breaks "nothing happens under the rug" invariant | AI proposals must be inspected and explicitly accepted/modified/rejected by the learner |
| Code hidden from learner | Breaks visible-code invariant | Code panel remains present and inspectable across portrait/landscape |
| Mission completion driven by model judgment | Non-deterministic, unauditable completion | Completion gated on deterministic runtime evidence, not LLM claims |
| Provider outage breaks the app | Learner blocked, safety risk | Provider-unavailable path must degrade safely (see #96 dependency) |
| Child-facing copy inappropriate | Content-guide/safety violation | Copy reviewed against content guide before ship |
| No explicit dependency declared in source issue | Scope surprises during Construction | Track #91's real dependency on #96 (provider/offline) explicitly during Construction |
