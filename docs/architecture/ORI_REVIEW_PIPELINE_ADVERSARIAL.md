# Ori review pipeline: adversarial regression gate

This increment tests the existing internal, disabled-by-default pipeline before any HTTP route is registered.

## Required checks

- Reject a provider plan containing unexpected proposal fields or claims of applied changes.
- Reject mission and pedagogical-stage mismatches, absent plans and invalid review status.
- Return a generic unavailable result on provider exceptions without exposing error messages.
- When disabled or the host is untrusted, do not read the request body or invoke Ori.
- Keep the full CI suite, TypeScript, lint, Prettier, build and real Ori interoperability mandatory.

The tests use only synthetic data and do not activate child-facing behavior.

## Remaining prerequisites

Before adding an actual admin route: explicitly bind a trusted-host configuration, handle request abort and timeout, verify adult session/CSRF, enforce a server-side mission allowlist, and test HTTP responses with a live server. The current pipeline alone is not production authorization.
