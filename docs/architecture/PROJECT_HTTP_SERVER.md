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

## Adult link (optional)

Set `AGORIX_LINK_SECRET` (at least 32 characters, from the host secret store) to enable the adult account
email and child device link routes (`/v1/account/email*`, `/v1/link/*`). Without it those routes return 404. nginx must pass the real client address in `X-Real-IP` (already configured for `/v1/`); the link
rate limits hash it and never store it. See `docs/safety/AUTH_SECURITY.md`.

### Verification email (SMTP)

Without a mail transport the link routes work but nobody receives the verification link, so configure one:

| Variable               | Meaning                                                                                                                                                               |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AGORIX_MAIL_SMTP_URL` | `smtps://user:pass@host` (implicit TLS, port 465) or `smtp://user:pass@host:587` (STARTTLS **required**). Percent-encode special characters in the user and password. |
| `AGORIX_MAIL_FROM`     | Envelope and header sender, for example `no-reply@agorix.example`.                                                                                                    |

Set both or neither (the server refuses to start with only one). The links in the message use
`AGORIX_PROJECT_ORIGIN`, so it must be the public HTTPS origin. Behaviour worth knowing:

- TLS is always verified. If the server does not offer STARTTLS the message is **not** sent and no
  credential is written; there is no downgrade. Plain text is accepted only for `localhost`,
  `127.0.0.1` and `::1` with `?plaintext=1` (for a local test relay).
- Delivery happens in the background: a slow or failing mail server never changes the HTTP answer
  (so it cannot reveal whether an address exists) and there is no automatic retry; the adult can use
  "Resend email" (60 s cooldown, 5 per hour).
- Failures are logged as `mail delivery failed: <kind>` (`connect`, `timeout`, `tls`, `auth`, `rejected`,
  `protocol`). The address, the token, the SMTP URL and the server's reply are never logged.
- The message is bilingual plain text (Spanish first). A second message, "email already in use", goes to
  the address owner when someone tries to take it; it contains no token or link.
- Staging check before enabling for real families: create an account, receive the message, open the
  link, link a tablet; also try a wrong password in `AGORIX_MAIL_SMTP_URL` and confirm the log line has
  kind `auth` only. See [MAIL_STAGING_CHECK.md](../deployment/MAIL_STAGING_CHECK.md) for the automated
  loopback inbox and the optional external staging checklist.
