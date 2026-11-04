# OpenCode isolation policy — experimental adult-only host

The `src/opencode-deny-all-policy.mjs` module produces a fail-closed OpenCode v1 configuration template with `permission: {"*":"deny"}` and an explicit deny for the `plan` agent. It must be used in addition to `verifyOpenCodeIsolation`, never instead of it.

## Limits
- OpenCode configuration files can merge across locations. Verify the **effective** config, not just this template.
- OpenCode versions may change permission schema (v1 vs v2); pin and validate a known version before launch.
- A deny-all config is not an OS sandbox: isolate filesystem, credentials, network, process privileges and workspaces independently.
- No child-facing activation or automatic project edits.
- This PR does not start OpenCode or connect its adapter to the default provider router.

## Verification gates
1. Run `npm test` and `npm run check`.
2. Validate effective config and absence of inherited permissions or MCP tools in a disposable environment.
3. Exercise native session lifecycle with a pinned OpenCode release and verify that tool calls are denied.
4. Document and review the threat model before any child-facing rollout.

Agorix integration remains exclusively on `integration/ori`.
