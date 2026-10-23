# Running Agorix on the Modern Ash host

Operational runbook for the production Web at <https://agorix.modern-ash.com> (issue #343, epic #349).
It describes this host's setup. For generic self-hosting see [SELF_HOSTING.md](./SELF_HOSTING.md); for
the audit that preceded launch see [WEB_PRODUCTION_READINESS.md](./WEB_PRODUCTION_READINESS.md).

## Architecture

```text
Browser
  -> Cloudflare (TLS, DNS)
  -> cloudflared tunnel "modern-ash"            (user service, outbound only)
  -> 127.0.0.1:8470  nginx container "agorix-web" (static dist + security headers)
  -> /api/tutor/*    Unix socket in user runtime directory
                     -> host user service "agorix-tutor" -> Codex/OpenCode CLI
  -> /v1/*           Unix socket for the project server
                     -> JSON 404 while its explicit accounts profile is off
```

- The tunnel is the only ingress. No port is opened on the router; the container is bound to
  loopback only (`127.0.0.1:8470`). Other `*.modern-ash.com` hostnames (for example Paperclip) share the
  same tunnel and are separate ingress rules.
- The site remains playable without the host tutor service. Anonymous projects live in the browser;
  `.agorix` export/import is the portable path. Accounts and server-side project storage are separate work.
- The `/v1/*` route does not serve the SPA shell. It proxies to the project socket when a service
  is present and returns JSON 404 otherwise. The SQLite project service has a separate Compose
  `accounts` profile and persistent data volume. It requires explicit activation after review;
  see [PROJECT_SQLITE_STORE.md](../architecture/PROJECT_SQLITE_STORE.md).
- `/` serves Agorix Kids. `/kids` remains an alias for existing links; `/advanced` serves the parked
  editor with actors, sounds, events and code views. The production smoke checks both routes.
- Everything is defined in the repository: `deploy/web/` (Dockerfile, `nginx.conf`, generated
  `security-headers.conf`, compose and the host user service template) and `scripts/`.

## Deploy

From a clean `main` that matches `origin/main`:

```bash
pnpm deploy:web
```

The script (`scripts/deploy-web.sh`) does, in order, and stops at the first failure:

1. **Preflight.** Refuses any branch except `main`, a dirty tree, or a local `main` that differs from `origin/main`.
2. `pnpm verify`.
3. Builds the image `agorix-web:<sha12>` (the commit is baked in as `/version.json`; the parked
   editor also shows it in its app menu).
4. Swaps the container (`restart: unless-stopped`, loopback only).
5. **Health gate.** `/healthz`, the CSP header, and `/version.json` reporting the new commit.
6. **Smoke gate.** The read-only production smoke (`apps/web/e2e/prod`) through the public URL.
7. Keeps the newest 5 images.

If step 5 or 6 fails, the previous image is put back automatically and the script exits non-zero.
A deploy causes a few seconds of unavailability while the container is replaced.

Options: `--preflight-only`, `--skip-verify` (emergency; already verified commit), `--skip-smoke`.
Environment: `AGORIX_WEB_URL` (local health URL), `AGORIX_SMOKE_URL` (public URL), `AGORIX_HEALTH_TIMEOUT`,
`AGORIX_KEEP_IMAGES`, `AGORIX_NOTIFY_CMD` (a command that receives an alert message).

## Roll back

```bash
pnpm rollback:web            # lists images and the running tag
pnpm rollback:web <sha12>    # run a previous image, with the same health check
```

Emergency stop (the hostname then answers an error from Cloudflare until restarted):

```bash
docker compose -f deploy/web/docker-compose.yml down
```

## Checking the live site

```bash
curl -s https://agorix.modern-ash.com/version.json           # {"version":"...","sha":"..."}
AGORIX_E2E_BASE_URL=https://agorix.modern-ash.com pnpm --filter @agorix/web test:prod
scripts/watch-web-prod.sh                                     # same smoke, alerts through AGORIX_NOTIFY_CMD
```

To run the watch on a schedule, add a crontab line yourself (it is not installed automatically):

```cron
*/15 * * * * AGORIX_NOTIFY_CMD="/path/to/your/notify-command" /path/to/agorix/scripts/watch-web-prod.sh
```

Keep notification credentials out of the repository and out of scripts; read them from your environment.

## The tunnel

- The tunnel runs as the **user** service `cloudflared` (token file, `Restart=always`, lingering enabled, so it
  starts at boot without a login):

```bash
systemctl --user status cloudflared
systemctl --user restart cloudflared
journalctl --user -u cloudflared -f
```

- A system-wide `cloudflared.service` may also exist that points to a missing `config.yml` and restarts
  forever. It is not the live tunnel; disabling it (`sudo systemctl disable --now cloudflared`) removes the
  log noise. Do not confuse the two.
- Ingress (hostname to local port) is managed remotely, in the Cloudflare Zero Trust dashboard under the
  tunnel's public hostnames, or through the Cloudflare API. To publish a new hostname: add the public
  hostname pointing to `http://localhost:<port>` and create its DNS record (the dashboard does both).
- The credential files in `~/.cloudflared/` are secrets. They are never copied into this repository.

## Logs

| What                       | Where                                   |
| -------------------------- | --------------------------------------- |
| nginx access/error         | `docker logs agorix-web`                |
| Tutor service (if enabled) | `journalctl --user -u agorix-tutor`     |
| Tunnel                     | `journalctl --user -u cloudflared`      |
| Deploy output              | the terminal that ran `pnpm deploy:web` |

## Caching and service worker

- `index.html`, `sw.js`, `manifest.webmanifest` and `/version.json` are served `no-cache`/`no-store`; hashed
  `/assets/*` are immutable for a year (misses are not cached).
- Cloudflare revalidates `/sw.js` with the origin on every request, so the edge never serves a stale script. It
  rewrites the browser-facing header to `max-age=14400` for `.js` files; browsers fetch a service worker's own
  script bypassing the HTTP cache, so a new deploy still reaches users.
- The service worker is network-first for same-origin GETs and never caches `/api/*` or `/v1/*`.

## Host tutor service (Kids 10)

Codex and OpenCode use the host user's existing CLI login. The model process receives a numeric/type
summary of the child's program and deterministic runtime facts, never free child text. Ori's model
output is validated as a proposal; a missing CLI, timeout or invalid JSON uses Kids 08 local rules.
The model process has no enabled tools and runs from a temporary workspace. Codex uses its read-only
sandbox; OpenCode denies all tool permissions. The process is killed after at most seven seconds. No
CLI credentials or prompts are stored in the repository or tutor logs.

The nginx container receives only a read-only bind mount of the tutor socket directory. The tutor
listens on `%t/agorix-tutor/tutor.sock` inside the host user's runtime directory, not on a TCP port.
`pnpm deploy:web` creates the mount directory if absent, so the Web starts and falls back cleanly
before this service is enabled. The old Docker Compose `ai` profile is no longer used.

From a merged, clean `main` on this host, after `pnpm deploy:web` has published the
same commit (including the 9-second Nginx tutor proxy budget):

```bash
scripts/activate-tutor-host.sh --preflight-only
# After separate owner authorization for production activation:
scripts/activate-tutor-host.sh --activate
```

The activation script requires a clean, synced `main`, a logged-in Codex CLI and a matching public
`version.json`. It builds the tutor, installs and starts its user unit, then sends a synthetic
mission through the public route. The read-only `node scripts/check-ori-live.mjs` verifies
`lastOriSource: model` on the adult health endpoint and a bounded, structured proposal. It prints
provider and latency only; no child data or model text. If activation fails, the script disables
and removes the new service; the Web keeps its deterministic fallback. For a later check, use
`scripts/activate-tutor-host.sh --verify-only`.
The script waits for the local socket before the public check. If an earlier failed activation
left Docker bound to a removed runtime directory, it recreates the Web container with the same
deployed image to renew that mount. The service preserves its runtime directory across restarts.

The unit's `WorkingDirectory` and `ExecStart` assume `%h/dev-agora/agorix`; run activation from
that checkout. After a future merge that changes `apps/tutor-api`, rebuild it and run
`systemctl --user restart agorix-tutor`. The systemd unit supervises failures and preserves the
existing user login. Set `AGORIX_ORI_PROVIDER=auto` (default: probe Codex, then OpenCode), `codex`,
`opencode`, or `disabled` in the optional host-only environment file. Codex defaults to
`gpt-6-luna`; `AGORIX_ORI_CODEX_MODEL` can select another model supported by the host login.
`AGORIX_ORI_TIMEOUT_MS` is bounded to 0.5–7 seconds. Nginx waits 9 seconds and the browser allows
10 seconds; this order lets a valid model answer arrive while each layer remains bounded. The health
probe uses `--version` and caches its result for 15 seconds;
it does not spend model tokens.

The Kids editor calls `POST /api/tutor/ori` for authored missions. It validates the returned
proposal again against the current program and allowed Kids blocks. A failed, invalid or late
response uses the deterministic Ori card without provider wording; the browser budget is 10
seconds. The free world still uses local rules.

Manual host check: send a same-origin `POST /api/tutor/ori` with a canonical program fixture and
verify that only `message` and a reviewable `proposal` return. In the Kids editor, confirm that
proposed blocks require an explicit child decision and rejection leaves the program unchanged.
Stop the service with `systemctl --user stop agorix-tutor`; `/api/tutor/health` should report local
mode and the editor must still offer its deterministic Ori card.

See [SELF_HOSTING.md](./SELF_HOSTING.md) for the API fields and alternate server-side providers.

## Troubleshooting

| Symptom                                            | Check                                                                                                |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Site down, `curl localhost:8470/healthz` fails     | `docker ps`, `docker logs agorix-web`, then `pnpm rollback:web <sha12>`                              |
| Local 200 but public error                         | `systemctl --user status cloudflared`, tunnel logs, ingress rule in the dashboard                    |
| Deploy stops at preflight                          | Check the branch, `git status`, and `git fetch && git status -sb`                                    |
| Deploy rolled back after the smoke                 | Run the smoke by hand and read the failing test; the previous image is serving                       |
| A browser shows an old app                         | Hard reload; `curl -I https://agorix.modern-ash.com/sw.js` should be revalidated, not `HIT`          |
| Console errors mentioning `cloudflareinsights.com` | Disable Cloudflare Web Analytics auto-injection; production smoke rejects third-party scripts (#365) |

## Not in production yet

- Account activation and scheduled SQLite backups (see the storage runbook above).
- Host tutor service activation (requires a host CLI login and an explicit operator action).
- Tablet layout, English leftovers, PNG icons and the accessibility pass (#359, #360, #361, #362).
- Disabling Cloudflare's injected analytics (#365); remove this line after the dashboard change is verified.
