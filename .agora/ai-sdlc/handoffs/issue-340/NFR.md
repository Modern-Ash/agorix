# Issue 340 Non-Functional Requirements

- Security: loopback-only publish; image holds only built static files; no secrets, no dev backend; headers on all responses.
- Reliability: healthcheck and `unless-stopped` restart policy.
- Reproducibility: pinned Node/pnpm versions from `.nvmrc` and `packageManager`; lockfile install frozen.
- Performance: gzip for text assets; immutable caching for hashed assets.
- Testability: header parity is enforced by an automated test without Docker.
