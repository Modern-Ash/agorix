# Issue 340 Unit Of Work

## In Scope

- Container build definition, nginx config, compose file and the header-drift test under `deploy/web` and `scripts`.
- Local build/run verification of headers, cache policy, MIME types, SPA fallback, healthz and 404 on `/__dev/auth`.

## Out Of Scope

- Cloudflare tunnel/DNS and edge cache rules (#341).
- Deploy automation, rollback and version endpoint (#342).
- Runbook and docs (#343), production readiness audit (#344), prod smoke (#345).
- Accounts, project API, SQLite, tutor API (#346-#348).

## Dependencies

- #341 reserved port 8470 and the tunnel hostname; this unit consumes them.
- `apps/web/src/securityHeaders.ts` is the single source for headers.
