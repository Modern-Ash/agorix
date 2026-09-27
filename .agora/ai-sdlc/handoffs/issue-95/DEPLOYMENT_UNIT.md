# Issue 95 Deployment Unit

Bounded deployable unit for the migration of real-LLM tutor work into optional
commercial provider adapters. Everything in the unit is server-side
(`apps/tutor-api`) and additive: the learner path is unchanged without a
credential.

## Contents of the unit

| Item | Path |
| --- | --- |
| Adapter configuration and delegation | `apps/tutor-api/src/index.ts` |
| Boundary tests | `apps/tutor-api/src/index.test.ts` |
| Gateway configuration and extension docs | `docs/providers/OPENAI_COMPATIBLE_GATEWAY.md`, `docs/architecture/SYSTEM_DESIGN.md` |
| Provider-neutral wording | `README.md` |

Branch `feat/issue-95-commercial-provider-adapters`, commit `03f037b`. No new
runtime dependency: the unit consumes the provider-neutral contract landed by
issues 92-94.

## Configuration contract

| Variable | Default | Purpose |
| --- | --- | --- |
| `AGORIX_TUTOR_ADAPTER` | `fake` | adapter selection |
| `AGORIX_TUTOR_BASE_URL` | unset | gateway base URL |
| `AGORIX_TUTOR_MODEL` | unset | model id |
| `AGORIX_TUTOR_AUTH_TOKEN` | unset | bearer token, read at the boundary only |
| `AGORIX_TUTOR_AUTH_HEADER` | `Authorization` | auth header name |
| `AGORIX_TUTOR_TIMEOUT_MS` | `4000` | request timeout |
| `AGORIX_TUTOR_CAPABILITIES` | `coach` | capability negotiation |
| `AGORIX_TUTOR_INCLUDE_LEARNER_QUESTION` | unset | opt-in to sending learner free text |

Deprecated aliases `AGORIX_TUTOR_PROVIDER`, `AGORIX_TUTOR_ENDPOINT` and
`AGORIX_TUTOR_API_KEY` keep existing deployments working; a legacy endpoint is
reduced to its base by dropping a trailing `/chat/completions`.

## Rollout

1. Deploy with the environment unset. The tutor boundary serves deterministic
   companion responses; the learner flow is identical to the pre-migration build.
2. Smoke-check that a tutor request returns the deterministic response and that
   no commercial endpoint is resolved in diagnostics.
3. Enable the commercial path per environment by setting `AGORIX_TUTOR_ADAPTER`,
   `AGORIX_TUTOR_BASE_URL` and `AGORIX_TUTOR_MODEL`; keep the token in the
   platform secret store, never in the repository.
4. Re-check the error codes: an outage or timeout must surface as a
   provider-neutral code with a deterministic learner response.

## Rollback

Configuration-only rollback: unset `AGORIX_TUTOR_ADAPTER` (or set it to `fake`).
The code path is additive, so no code rollback is required for an incident. If a
code rollback is ever needed, revert commit `03f037b`; the domain packages and the
canonical program model are untouched, so the revert is isolated to
`apps/tutor-api` and documentation.

## Operational constraints

- No provider credential is required for build, test or the core learning flow.
- No child personal data is persisted; conversation history stays in-memory.
- The token is never echoed into diagnostics, errors, fixtures or logs.
- The change is a capability addition, not a data migration: no backfill, no
  schema change, no downtime window.
