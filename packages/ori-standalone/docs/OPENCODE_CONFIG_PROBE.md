# OpenCode effective config probe (adult-only experimental)

`probeOpenCodeEffectiveConfig` requests `GET /config` from a loopback-only OpenCode server and checks the returned JSON against Ori's restrictive policy. The request has a 1.5-second timeout and a 32 KiB response cap.

This is a **runtime snapshot check**, not a complete security attestation. OpenCode may have additional permissions, plugins, inherited settings, or tool access that require independent inspection. The probe does not launch or isolate OpenCode and does not enable child-facing access.

## Reproducibility
1. Pin an OpenCode release and inspect its local API specification (`/doc`) for the exact config response shape.
2. Launch the server in a disposable, restricted environment with no credentials or sensitive mounts.
3. Invoke the probe from a trusted operator process.
4. Verify denied tool execution through adversarial tests, not only JSON inspection.
5. Document the effective permission matrix and runtime isolation evidence before enabling the native adapter.

No Agorix changes; integration work targets `integration/ori` only.
