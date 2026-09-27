# Issue 92 Risk Register

| Risk | Impact | Mitigation | Owner |
| --- | --- | --- | --- |
| Provider-runtime contract leaks vendor-specific fields. | Future adapters couple domain code to provider families. | Unknown/provider-specific payloads stay in adapter implementation, not shared contract. | Developer |
| Contract duplicates Learning Companion schema from #85. | Confusing ownership and validation drift. | Treat #85 request/response as domain payload carried through provider runtime transport. | Developer |
| Capability negotiation is too vague. | #93/#94 cannot know why fallback is needed. | Return explicit supported/missing capabilities and reason codes. | Developer |
| Timeout/cancel behavior differs across adapters. | UI cannot degrade predictably. | Normalize timeout/cancel/error taxonomy in contract tests. | Developer |
| Fake adapters hide real-world constraints. | Later real adapters discover missing interface needs. | Include context limits, structured-output support and local/remote indicators in fake capabilities. | Developer |
| Secrets accidentally enter client-facing packages. | Security/privacy violation. | Keep runtime contract free of credentials; document server-side provider boundary. | Developer |
