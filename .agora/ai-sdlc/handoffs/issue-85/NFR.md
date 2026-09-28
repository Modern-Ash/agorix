# Issue 85 Non-Functional Requirements

## Provider Neutrality

The domain package must not expose OpenAI, Anthropic, Ollama or other provider-specific request/response fields. Provider selection, credentials, retries and transport stay outside `@agorix/tutor-contract`.

## Child Safety And Privacy

Requests must be useful with mission context, canonical program state, runtime evidence and learner intent only. Names, email, school, location, contact information, raw long-term chat history and unrelated child profile data must not be required by the contract.

## Validation

All externally supplied Learning Companion responses must pass structured validation before consumers treat them as usable. Unknown provider-specific fields should fail closed.

## Authorship Boundary

The builder capability may return a structured proposal only. It must not provide a field that consumers can mistake for accepted canonical state.

## Runtime Evidence Boundary

The debugger capability must represent observed facts separately from suggestions, hypotheses or next-step guidance. The contract must make ungrounded runtime assertions testable.

## Compatibility

Existing tutor hint behavior should keep a migration path. The package may keep legacy `Tutor*` exports while adding Learning Companion exports.

## Package Hygiene

The package must remain TypeScript-only domain code with no React, Blockly, Phaser, Capacitor, VS Code API or provider SDK dependencies.
