# Test Strategy - issue #79

- `packages/language-projection/src/index.test.ts` proves registry/discovery and two independent projections satisfy one conformance helper.
- `packages/code-generator/src/project.test.ts` proves existing generator output is represented by the new contract and preserves snapshots/mapping.
- Full repository checks prove no downstream consumer breaks: `pnpm format:check`, `pnpm lint`, `pnpm build`, `pnpm test`, and `aisdlc verify --run`.
