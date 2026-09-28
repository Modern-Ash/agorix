# Issue 100 AI-SDLC Economics

## Active Configuration

From `ai-sdlc/project.yaml`:

- routing profile: `cheap-first`
- `allow_paid_auto: true`
- `allow_frontier_auto: false`
- retry limits: local 3, free 2
- call budgets: paid-efficient 4, paid-standard 2, frontier 0

## Application To #100

- Build the validator and tests with deterministic local tooling first.
- Use mocked provider fixtures instead of live model calls for acceptance evidence.
- Do not spend frontier calls.
- Use paid-efficient/paid-standard review only if deterministic checks pass and semantic safety review remains useful.
- Record usage through Agora only when real external telemetry exists; missing telemetry stays unknown, not zero.
