# Issue 85 Test Strategy

## Targeted Tests

`pnpm exec vitest run packages/tutor-contract/src/index.test.ts` covers:

- valid data-minimized Learning Companion request;
- migration from legacy tutor request/response to coach capability;
- deterministic fake output for all six capabilities;
- builder proposal boundary;
- debugger facts vs suggestions boundary;
- malformed/provider-specific response fail-closed behavior;
- same conformance helper for local and remote-style providers;
- package dependency check for provider SDK absence.

## Integration Checks

- `pnpm lint` validates repository lint with no warnings.
- `pnpm test` validates the full Vitest suite.
- `pnpm build` validates all workspace TypeScript builds and Vite production build.

## Environment Note

Commands ran under Node v20.19.0 with repo warning that Node `>=22 <23` is expected. The commands still passed except for the expected engine warning.
