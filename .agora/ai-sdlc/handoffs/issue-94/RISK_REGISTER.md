# Issue 94 Risk Register

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Compatible servers differ in feature support. | Adapter may overpromise capabilities. | Declare capabilities by configuration and fail explicitly. |
| Auth could leak to browser code. | Privacy/security boundary failure. | Keep auth in provider-runtime configuration and docs as server-side only. |
| Malformed JSON could bypass safety. | Unsafe or invalid Learning Companion output. | Validate every response before success. |
| External tests could become flaky. | CI instability. | Use injected fetch mocks and fixtures. |
| Adapter may be mistaken for OpenAI product dependency. | Architecture and licensing confusion. | Document as protocol adapter and add no OpenAI SDK. |
