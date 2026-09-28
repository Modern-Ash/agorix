# Issue 100 Intent

Create a single enforceable AI-output validation and child-safety boundary before any provider output reaches learner-facing UI, ProgramProposal workflows, diagnostics, or canonical program mutation paths.

The boundary must fail closed for malformed structured output, unsafe capability requests, over-assistance, unsafe program operations, PII-seeking content, hidden tool actions, and provenance/context integrity failures. It must behave consistently across local, open, remote, and optional commercial providers.

Execution must follow the current AI-SDLC economics policy: cheap-first routing, deterministic checks and mocked/adversarial fixtures before model spending, no frontier automatic calls, and authoritative usage recording only when real telemetry exists.
