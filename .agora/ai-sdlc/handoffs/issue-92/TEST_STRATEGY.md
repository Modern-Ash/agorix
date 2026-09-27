# Issue 92 Test Strategy

## Targeted Tests

`pnpm exec vitest run packages/provider-runtime/src/index.test.ts` covers:

- provider-runtime package identity;
- no vendor SDK dependency;
- two fake adapters with different capability sets;
- explicit unsupported capability mismatch;
- structured-output mismatch;
- timeout, cancellation and provider-error normalization;
- provider/model configuration switching;
- deterministic conformance harness.

## Integration Checks

- `pnpm tsc --noEmit`
- `pnpm lint`
- `pnpm test`
- `pnpm build`

## Environment Note

Commands ran under Node v20.19.0 with the repo warning that Node `>=22 <23` is expected. The commands still passed.
