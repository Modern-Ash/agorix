# Issue 93 Risk Register

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Different Ollama models vary in structured output reliability. | Unsupported models could produce unsafe or unusable output. | Declare capabilities by configuration and validate every response before success. |
| Local daemon may be absent or unavailable. | Editor/runtime could appear broken if errors leak. | Normalize outage as provider runtime failure and keep deterministic fake default. |
| Integration tests could make CI flaky. | CI would depend on local machine state. | Use injected fetch/test doubles for required tests and gate real Ollama checks. |
| Adapter could leak Ollama concepts into domain packages. | Architecture boundary would drift. | Keep implementation inside provider-runtime and expose only provider-neutral contracts. |
| Timeout/cancellation behavior may differ across runtimes. | Slow local models could hang interactions. | Enforce timeout/cancellation through adapter options and tests. |
