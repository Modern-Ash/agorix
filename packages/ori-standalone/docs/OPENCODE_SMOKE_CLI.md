# Opt-in OpenCode gated smoke CLI

This command is **not** part of CI and must never run on a workstation with personal data or credentials. It exercises the merged config probe and native session adapter against a separately launched loopback OpenCode server.

## Prerequisites
- Pin an OpenCode version and validate its actual API using its local `/doc` endpoint.
- Start OpenCode in a disposable, OS-isolated environment with network restrictions, no credentials or sensitive mounts, and tools disabled by effective policy.
- Independently verify those properties. The environment variable below is only an operator declaration, not an isolation mechanism.

```bash
ORI_OPENCODE_SMOKE=I_HAVE_VERIFIED_ISOLATION npm run smoke:opencode
```

The smoke returns only a boolean summary of config validation and pedagogical hint acceptance. It does not verify every tool denial, process isolation, or educational effectiveness. A failure must block activation. Do not expose this to children.

Agorix changes remain restricted to `integration/ori`.
