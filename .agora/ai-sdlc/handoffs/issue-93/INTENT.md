# Issue 93 Intent

## Source

- GitHub issue: https://github.com/Modern-Ash/agorix/issues/93
- Parent epic: #67
- Dependencies: #92 provider runtime contract and #85 Learning Companion contract

## Intent

Implement a first-class local/open model adapter path for Agorix using Ollama, without making Ollama part of domain architecture and without changing the deterministic fake provider default used by CI.

## Product Outcome

Agorix can use a local Ollama daemon for a documented Learning Companion capability subset, while preserving child-safety boundaries:

- AI proposes; canonical program mutation remains validated and governed.
- Provider capability gaps are explicit.
- Offline or unavailable local model service does not break the editor/runtime.
- Browser code never needs provider credentials or local-model secrets.

## Architectural Decision

The adapter belongs behind `@agorix/provider-runtime`. Domain packages consume provider-neutral Learning Companion contracts and capability negotiation only. Ollama-specific request shape, endpoint configuration, health checks and output normalization stay inside the adapter boundary.
