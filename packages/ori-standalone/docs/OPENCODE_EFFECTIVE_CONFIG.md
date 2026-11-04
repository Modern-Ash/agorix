# Effective OpenCode configuration verification

The static deny-all template does not prove effective runtime permissions. OpenCode configuration can inherit or merge settings. `assertEffectiveOpenCodeConfig` validates a trusted effective-config snapshot against a restrictive policy.

## Required verification
1. Pin a specific OpenCode release and launch in a disposable, isolated workspace with no secrets.
2. Inspect its effective configuration through the documented runtime/config interface, not only the local template.
3. Pass that trusted snapshot through `assertEffectiveOpenCodeConfig`.
4. Exercise denied tool calls (shell, edit, read, filesystem, network, MCP) and verify enforcement.
5. Independently verify OS/container isolation, credentials, filesystem mounts, network policy, and process privileges.
6. Only then evaluate native adapter smoke tests with synthetic requests and educator review.

This PR implements a pure validator with synthetic tests. It **does not** fetch or attest a running OpenCode process, configure a container, or prove the absence of inherited settings. Do not enable child-facing use. Agorix work remains on `integration/ori` only.
