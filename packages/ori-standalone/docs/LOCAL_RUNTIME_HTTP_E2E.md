# Local agent runtime: HTTP integration milestone

This milestone tests the Ori local agent runtime over a **real loopback HTTP socket** with a synthetic OpenCode-shaped server. It verifies config-probe ordering, session create/message/delete, output guard, fallback and absence of program edits. It does **not** install or run OpenCode, and does not prove a sandbox.

## Automated CI
`npm test` discovers `test/local-agent-http-e2e.test.mjs` and starts a disposable server bound to 127.0.0.1 on an ephemeral port. No external network, credentials, cloud model or child data are used.

## Real OpenCode acceptance (still blocked)
- Pin and install OpenCode in a disposable isolated runtime
- Verify effective permissions and actual denial of shell, read, write, edit, network and MCP tools
- Run the opt-in smoke CLI and record version, policy and redacted evidence in `docs/OPENCODE_SMOKE_EVIDENCE.md`
- Check model output safety and session cleanup, then obtain security and educator approval

## Architecture and safety
Ori remains host-neutral. OpenCode is a provider for guarded educational hints, not an unrestricted coding agent in Kids mode. Agorix remains a separate client and any changes to it must target **only** `integration/ori`.
