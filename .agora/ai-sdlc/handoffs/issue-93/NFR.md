# Issue 93 Non-Functional Requirements

## Safety

- Fail closed on malformed or unsupported provider output.
- Do not silently weaken capability requirements.
- Never allow unvalidated provider text to mutate canonical program state.

## Reliability

- Local daemon outage must return a provider runtime failure, not throw through editor/runtime surfaces.
- Timeout and cancellation must be bounded and testable.
- CI must remain deterministic without Ollama installed.

## Privacy And Credentials

- No browser secret or network credential is required for Ollama.
- Endpoint and model configuration must be explicit and local-path oriented.

## Portability

- The adapter must remain TypeScript workspace code with no domain dependency on Ollama-specific concepts.
- Documentation must avoid assuming one machine, model size or hardware profile.
