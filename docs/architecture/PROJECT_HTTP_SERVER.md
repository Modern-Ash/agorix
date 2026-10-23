# Project HTTP server (#346)

`apps/server` adapts the existing `@agorix/project-api` handler to Node 22 HTTP. The transport accepts `/v1/*`, serves `GET /healthz`, and has no browser bundle or provider credentials. The account and project rules remain in `auth-service`, `project-api` and `project-repository`.

## Current deployment state

The entry point requires an explicit storage choice. `AGORIX_PROJECT_STORAGE=memory` is temporary and loses accounts, sessions and projects on restart. `AGORIX_PROJECT_STORAGE=sqlite` uses a durable database at `AGORIX_PROJECT_DB_PATH`; see [PROJECT_SQLITE_STORE.md](./PROJECT_SQLITE_STORE.md) for migrations, volumes, backups and restoration. The Web container has a read-only project socket mount and proxies `/v1/*` to it. While the project service is off, nginx returns JSON 404 with `Cache-Control: no-store`; it never sends SPA HTML for API requests. The production Web client targets `/v1/auth/*` and keeps account UI hidden until the service is explicitly activated.

For a local HTTP integration run, build with `pnpm --filter @agorix/server build` and set:

```text
AGORIX_PROJECT_STORAGE=memory
AGORIX_PROJECT_ORIGIN=https://agorix.modern-ash.com
AGORIX_PROJECT_PORT=8472
```

Then run `pnpm --filter @agorix/server start`. The TCP listener binds to `127.0.0.1` only. The alternative `AGORIX_PROJECT_SOCKET` binds a Unix socket; the host path is `${XDG_STATE_HOME:-$HOME/.local/state}/agorix-projects/run/projects.sock`, matching the read-only directory mounted into nginx. The entry point sets socket mode `0666` so the unprivileged nginx worker can connect, while exposure remains limited to local users and the container mount. It handles `SIGTERM`/`SIGINT` with a bounded graceful close.

## Security review

| Boundary              | Control and evidence                                                                                                                                                                                                       |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Network               | Node binds only loopback or an explicit Unix socket. nginx keeps the public path same-origin and caps requests at 1088 KiB.                                                                                                |
| Body and availability | Node collects at most `AGORIX_PROJECT_MAX_BYTES + 16 KiB`, enforces a 10-second request timeout, 5-second header timeout and 50-header limit; oversized bodies return `413` without parsing.                               |
| Authentication        | `AuthService` hashes passwords with scrypt, limits registration and sign-in attempts by normalized alias, rotates session tokens and revokes them on sign-out. Tokens stay in `HttpOnly; Secure; SameSite=Strict` cookies. |
| CSRF                  | Every mutation requires `X-Agorix-Request: 1`; supplied `Origin` must match the configured HTTPS origin. CORS is not enabled.                                                                                              |
| Authorization         | `project-api` obtains the owner from the resolved session; project lookups for another owner return the same 404 as missing ids. Request bodies cannot set owner ids.                                                      |
| Logging               | Transport logs only method, status and elapsed milliseconds. The API's optional log hook contains only route and status. No URL, account name, project id, cookie, password or body is logged.                             |
| Failure               | Unknown routes return JSON 404, internal failures generic JSON 503, and all responses set `no-store` and `nosniff`. nginx maps an absent socket to JSON 404.                                                               |

The HTTP integration tests cover registration, login, save, list, reopen, sign-out, owner separation, CSRF rejection, foreign Origin, body cap and authentication rate limits. SQLite tests cover persistence, concurrent revisions, migration integrity and backup restoration. The Compose `accounts` profile remains off until a separate production activation decision.
