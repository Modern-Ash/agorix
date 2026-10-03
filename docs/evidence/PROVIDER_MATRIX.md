# Provider and Learning Decision Plane conformance matrix

Evidence date: 2026-09-30.

This matrix records contract evidence, not a model ranking. A runtime is eligible only after
`LearningRequirements` permits generative assistance.

| Runtime class             | Locality                      | Adapter                 | Contract evidence                                                                                                   | Tested roles                                                         | Setup                                                    | Known limitations                                         |
| ------------------------- | ----------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------- | --------------------------------------------------------- |
| Deterministic route       | none                          | Learning Decision Plane | CI: provider selection bypassed and provider request forbidden                                                      | Challenger, Reflector, Debugger run-first; any `generativeNeeded=no` | none                                                     | Fixed deterministic fixtures only                         |
| Fake local                | local                         | provider-runtime fake   | CI: capability negotiation, normalized errors, Decision Plane local-only routing                                    | Coach, Debugger, Reflector                                           | none                                                     | Deterministic test double, not model-quality evidence     |
| Fake remote               | remote                        | provider-runtime fake   | CI: capability negotiation and remote-allowed fallback                                                              | Coach, Builder, Explainer, Challenger                                | none                                                     | Deterministic test double, not network/model evidence     |
| Ollama                    | local                         | Ollama adapter          | CI with injected fetch: endpoint/model config, health, timeout, cancellation, malformed output, capability mismatch | Contract coverage for configured capabilities                        | Ollama only for live/manual evidence; CI needs no daemon | CI verifies adapter contract, not a particular live model |
| OpenAI-compatible gateway | local or remote by deployment | compatible HTTP adapter | CI with injected fetch: config/auth optionality, normalized output/errors and capability contract                   | Contract coverage for configured capabilities                        | compatible endpoint for live/manual evidence             | Provider/model behavior is deployment-specific            |

## Decision Plane invariants

The CI conformance extension verifies:

1. `generativeNeeded=no` / deterministic reasoning bypasses provider selection entirely.
2. Local-only requirements cannot fall back to a remote runtime.
3. Remote-allowed requirements still use the existing ordered, capability-aware selector.
4. Capability support is explicit; a role never implies universal provider support.
5. Provider output remains subject to the same LearningCompanion schema/safety boundary.
6. ProgramProposal acceptance remains a learner decision and is not part of provider selection.

## Evidence interpretation

“Verified” above means the repository has deterministic CI evidence for the adapter/contract
behavior. It does **not** mean every model behind that adapter has equivalent quality,
pedagogical behavior, latency or structured-output reliability. Those are deployment/model
observations and must be recorded separately if measured.
