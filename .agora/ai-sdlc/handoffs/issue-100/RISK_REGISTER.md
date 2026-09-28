# Issue 100 Risk Register

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Validator is only used by one adapter path. | Remote/local behavior diverges. | Put the boundary in shared code and add conformance tests across provider runtimes. |
| Rejection exposes raw provider output. | Child safety/privacy violation. | Split safe child message from developer diagnostics and redact by default. |
| Validator allows unsafe ProgramProposal operations. | Canonical program corruption. | Reuse ProgramProposal/program-model validation and add adversarial fixtures. |
| Missing #90 policy blocks over-assistance enforcement. | Full-solution responses may slip through. | Implement a minimal policy seam with explicit TODO/dependency and tests for issue #100 cases. |
| Model-assisted review exceeds economics budget. | AI-SDLC budget drift. | Run deterministic tests first; no frontier auto; record only authoritative usage. |
