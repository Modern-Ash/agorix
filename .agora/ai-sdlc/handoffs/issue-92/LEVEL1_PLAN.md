# Issue 92 Level 1 Plan

## Intent

Define a provider-neutral LLM runtime and capability negotiation contract for Learning Companion providers without coupling Agorix domain code to vendor SDKs or specific model families.

## Source Alignment

- GitHub issue: #92.
- Parent epic: #67.
- Depends on #85 Learning Companion contract.
- Current legacy boundary: `apps/tutor-api`.
- Architecture rules: provider credentials stay server-side; provider SDKs do not enter domain packages; browser/client code gets no secrets.

## Delivery Scope

1. Define a shared TypeScript provider runtime contract, preferably in a small provider-runtime package or clearly isolated provider-boundary module.
2. Model runtime identity, model/config identity, supported Learning Companion capabilities, local/remote execution, structured-output support, streaming/tool-call support flags, context/token limits, timeout/cancellation, health and availability.
3. Define capability negotiation results that make unsupported capabilities explicit and machine-readable.
4. Define normalized error taxonomy for unavailable provider, timeout, cancellation, invalid response, unsupported capability, authentication/configuration and provider failure.
5. Add at least two fake adapters with different capability sets.
6. Add conformance tests proving local and remote-style adapters use the same interface.
7. Document dependency direction and provider isolation.

## Out Of Scope

- Real Ollama adapter implementation (#93).
- Real OpenAI-compatible gateway adapter (#94).
- Optional commercial provider migration (#95).
- Product UI provider selection/fallback (#96).
- Multi-provider conformance matrix beyond focused harness (#97).

## Implementation Sequence

1. Contract model: provider/model ids, runtime config, capability descriptors, request/response envelope and negotiation result.
2. Error/timeout model: normalize cancellation, timeout and provider failures.
3. Fake adapters: local fake and remote fake with intentionally different capability sets.
4. Conformance harness: prove capability negotiation, mismatch behavior and shared interface.
5. Configuration helper: switch provider/model through config without domain changes.
6. Architecture docs: dependency direction and safety constraints.
7. Verification: targeted tests, typecheck/build and CI evidence.

## Handoff Boundary

Construction may begin only after Product Owner approval of this inception and developer approval for inception. Product Owner acceptance and completion remain separate governed actions.
