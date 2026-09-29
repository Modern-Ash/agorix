# Issue 95 Risk Register

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Commercial adapter leaks provider assumptions into domain types. | Future local/open providers become harder to support. | Keep adapter names/configuration at runtime boundary and assert domain types remain neutral. |
| Remote response bypasses ProgramProposal validation. | Canonical curriculum may be corrupted. | Reuse the same parser/validator and add conformance tests for invalid responses. |
| Secrets accidentally enter browser bundle or source. | Security incident. | Keep configuration server-side, use env names only in docs, and test no credentials are needed. |
| Provider outage blocks core learning flow. | Runtime/editor becomes fragile. | Preserve fallback policy to configured alternate provider, fake provider, or offline experience. |
| Docs imply one proprietary vendor is preferred. | Architecture guidance conflicts with provider-neutral goal. | Describe commercial adapters generically and list extension points without preference language. |
