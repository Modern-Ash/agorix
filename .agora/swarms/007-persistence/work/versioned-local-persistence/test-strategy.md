---
schema: "agora/artifact/v1"
kind: "test-strategy"
swarm: "persistence"
work: "versioned-local-persistence"
---

# Test Strategy

## Unit Coverage

`packages/persistence/src/index.test.ts` covers:

- save/load round trip;
- missing project error path;
- corrupted JSON error path;
- unknown future version error path;
- registered migration path;
- React-free package import.

## Integration Coverage

`apps/web/src/App.test.tsx` covers:

- editor model reconstruction from canonical program;
- generated code regenerated from canonical state;
- browser storage contains `program` and `metadata`;
- browser storage does not contain generated code;
- future-version load failure does not overwrite saved data;
- corrupted load failure does not overwrite saved data.

## Verification Command

`pnpm test`

Observed result during construction:

- test files: 15 passed;
- tests: 110 passed;
- exit code: 0.

Environment note: pnpm reports the repository engine expects Node `>=22 <23`;
the local verification ran on Node `v20.19.0`.
