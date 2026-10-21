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
  -> /api/tutor/*    tutor container "agorix-tutor" (optional, profile `ai`, not published)
```

- The tunnel is the only ingress. No port is opened on the router; the container is bound to
  loopback only (`127.0.0.1:8470`). Other `*.modern-ash.com` hostnames (for example Paperclip) share the
  same tunnel and are separate ingress rules.
- The site is fully static: anonymous projects live in the browser; `.agorix` export/import is the
  portable path. Accounts, project storage and a connected AI are not part of production yet.
- Everything is defined in the repository: `deploy/web/` (Dockerfile, `nginx.conf`, generated
  `security-headers.conf`, compose) and `scripts/`.

## Deploy

From a clean `main` that matches `origin/main`:

```bash
pnpm deploy:web
```

The script (`scripts/deploy-web.sh`) does, in order, and stops at the first failure:

1. **Preflight.** Refuses any branch except `main`, a dirty tree, or a local `main` that differs from `origin/main`.
2. `pnpm verify`.
3. Builds the image `agorix-web:<sha12>` (the commit is baked in as `/version.json` and shown in the app menu).
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
| Tutor service (if enabled) | `docker logs agorix-tutor`              |
| Tunnel                     | `journalctl --user -u cloudflared`      |
| Deploy output              | the terminal that ran `pnpm deploy:web` |

## Caching and service worker

- `index.html`, `sw.js`, `manifest.webmanifest` and `/version.json` are served `no-cache`/`no-store`; hashed
  `/assets/*` are immutable for a year (misses are not cached).
- Cloudflare revalidates `/sw.js` with the origin on every request, so the edge never serves a stale script. It
  rewrites the browser-facing header to `max-age=14400` for `.js` files; browsers fetch a service worker's own
  script bypassing the HTTP cache, so a new deploy still reaches users.
- The service worker is network-first for same-origin GETs and never caches `/api/*` or `/v1/*`.

## Optional AI service

Off by default; the public site then shows "Modo local". An adult enables it:

```bash
cp deploy/web/tutor.env.example deploy/web/tutor.env     # edit; git-ignored
docker compose -f deploy/web/docker-compose.yml --profile ai up -d --build
```

See [SELF_HOSTING.md](./SELF_HOSTING.md) for what the endpoints do and for how a provider on the host
(for example Ollama on loopback) can or cannot be reached from a container.

## Troubleshooting

| Symptom                                            | Check                                                                                       |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Site down, `curl localhost:8470/healthz` fails     | `docker ps`, `docker logs agorix-web`, then `pnpm rollback:web <sha12>`                     |
| Local 200 but public error                         | `systemctl --user status cloudflared`, tunnel logs, ingress rule in the dashboard           |
| Deploy stops at preflight                          | Check the branch, `git status`, and `git fetch && git status -sb`                           |
| Deploy rolled back after the smoke                 | Run the smoke by hand and read the failing test; the previous image is serving              |
| A browser shows an old app                         | Hard reload; `curl -I https://agorix.modern-ash.com/sw.js` should be revalidated, not `HIT` |
| Console errors mentioning `cloudflareinsights.com` | Known: Cloudflare's injected analytics beacon, blocked by the CSP (#365)                    |

## Not in production yet

- Accounts, server-side projects and a database (#346, #347).
- A connected AI and the client using it (#356); the status badge works today.
- Tablet layout, English leftovers, PNG icons and the accessibility pass (#359, #360, #361, #362).
- Disabling Cloudflare's injected analytics (#365).
