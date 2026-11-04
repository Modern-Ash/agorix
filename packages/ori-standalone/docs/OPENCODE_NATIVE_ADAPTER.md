# Experimental native OpenCode server adapter

This adapter uses the documented OpenCode server session API, not the OpenAI-compatible gateway. Documentation: https://docs.opencode.ai/docs/server/ and https://docs.opencode.ai/docs/sdk/.

Protocol used: `POST /session` creates a session, `POST /session/:id/message` submits a constrained text prompt, and `DELETE /session/:id` cleans up. The implementation is synthetic/adult-supervised and does **not** establish that a real local OpenCode server has passed interoperability tests.

## Important security boundary
OpenCode is a coding agent with powerful tools. The adapter requests disabled tools but **this is not a security sandbox**. For any future child-facing use, run a separately isolated, restricted server process without access to user files, credentials, shell, git or unrestricted network. Validate the pinned OpenCode release and actual tool policy before enabling. No automatic edits or child data should be sent.

## Verification
1. Pin a tested OpenCode version and start its server bound to 127.0.0.1.
2. Verify the exact API against `/doc` on that running version.
3. Run mock contract tests (`npm test`), then an opt-in local smoke with a disposable project and restricted model.
4. Inspect session cleanup, cancellation, no tool invocation, output guards and deterministic fallback.
5. Do not enable in Agorix Kids until independent safety review.

This adapter is not wired into the default dual-provider preview yet.
