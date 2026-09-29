# Operational readiness — issue #28

Scope: POC, local-only. No server, account, or hosted environment exists; "deployment" is the merge of PR #47 into `main`.

- Storage: browser `localStorage`, keys prefixed `agorix:` (`packages/persistence/src/store.ts`). No network, no PII.
- Schema: versioned via `SCHEMA_VERSION` from `@agorix/program-model`; unknown/future versions fail safely (`PersistenceError`).
- Verification at commit as recorded in evidence: `pnpm test` 110/110, `pnpm audit --prod` 0 vulnerabilities.
- Monitoring: none (no telemetry by design).
