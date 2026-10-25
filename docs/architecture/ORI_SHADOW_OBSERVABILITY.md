# Ori shadow observability (experimental)

The Agorix integration branch now has an **optional in-memory counter sink** for the shadow transport. It records only categorical outcomes: `valid`, `invalid-contract`, `oversized`, `http-error`, `timeout`, and `network-error`.

No child text, project AST, session, IP, prompt, model output or per-child event is stored. Counters are process-local and reset on restart. They are not yet exposed through HTTP or a metrics exporter.

## Usage

```ts
const metrics = createOriShadowMetrics();
const shadow = createOriShadowTransport(localEndpoint, fetch, metrics);
// ... call shadow with synthetic metadata ...
const aggregate = metrics.snapshot();
```

This optional instrumentation does not change the existing tutor response, default feature flag, or child-facing UI. The normal production entrypoint does not configure a metrics sink yet.

## Next gate

After review, inject a per-server metrics instance behind the existing shadow feature flag and export **only aggregate counters** to an adult-only diagnostics surface, with access control. Validate timeouts and load before any release. No promotion to `main` or `development` without explicit approval.
