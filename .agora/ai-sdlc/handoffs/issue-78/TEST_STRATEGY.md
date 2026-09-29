# Test Strategy - issue #78

- Web unit smoke keeps the server-rendered shell aware of the new proposal control.
- Playwright `runTransparencyJourney` verifies the full no-hidden-mutation journey with a deterministic fake proposal provider.
- The journey asserts code remains visible, preview/reject do not change the canonical hash, accept changes blocks and code from canonical state, Step maps through canonical node id, trace is child-readable, Run completes deterministically, and orientation changes preserve accepted state.
- Coverage runs on desktop, tablet portrait, and tablet landscape without hover, drag, right-click, network, real LLM, or arbitrary sleeps.
- Full checks: `pnpm format:check`, `pnpm lint`, `pnpm build`, `pnpm test`, `pnpm --filter @agorix/web test:e2e`, and `aisdlc verify --run`.
