# Web production readiness audit

Audit of the static Web client served at <https://agorix.modern-ash.com> (issue #344, epic #349).
Method: built bundle inspection, Chromium (Playwright) against the production container at
tablet landscape 1180x820 and phone 390x844 in Spanish, network and console capture, and a
read of the service worker and manifest. Date: 2026-10-20.

## Checklist

| Area                                    | Result     | Notes                                                                                                                                                                                                     |
| --------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dev backend absent from the bundle      | Partial    | No `devBackendPlugin`, in-memory repositories or `AGORIX_DEV_BACKEND`. The dev route name `/__dev/auth` is the client's default account path; nginx answers 404 for it. Tracked in #358.                  |
| No localhost or dev URLs in the bundle  | Pass       | Only XML namespace URLs and the React error-decoder link.                                                                                                                                                 |
| Network calls are same-origin only      | Pass       | Observed: `GET /`, `GET /api/tutor/health`, `GET /v1/session`. CSP `connect-src 'self'` holds.                                                                                                            |
| Console/page errors on load             | Pass       | None at either viewport.                                                                                                                                                                                  |
| No backend: accounts degrade gracefully | Pass       | No account UI is shown (`/v1/session` is not served; the SPA fallback is treated as unavailable). Anonymous work plus `.agorix` Exportar/Importar is the complete path. Make `/v1/*` a clean 404 in #358. |
| Companion without providers             | Pass       | `/api/tutor/health` answers `configured:false`; UI shows "Modo local".                                                                                                                                    |
| Sound under the CSP                     | Pass       | `media-src 'self'`; no third-party audio hosts.                                                                                                                                                           |
| Installable PWA                         | Partial    | Manifest, scope, start_url, theme and offline shell work (covered by e2e). SVG-only icons: raster icons and a share image tracked in #361.                                                                |
| Service worker update path              | Pass       | Network-first for same-origin GET, `skipWaiting` + `clients.claim`, `/api/*` and `/v1/*` never cached. A stale Cloudflare edge copy of `sw.js` (browser TTL 4 h) is a zone setting tracked in #341.       |
| Metadata for production                 | Fixed here | `<html lang="es">`, Spanish manifest `lang`/`description`, meta description and Open Graph tags.                                                                                                          |
| Responsive layout                       | Fail       | Tablet landscape clips the stage panel and the mission card; 16/72 (tablet) and 25/72 (phone) controls are under 44px. Tracked in #359.                                                                   |
| Spanish copy complete                   | Fail       | English strings remain in the Spanish UI. Tracked in #360.                                                                                                                                                |
| Lighthouse / axe                        | Not run    | No tooling in the audit environment. Tracked in #362. Structural checks only: no unnamed controls, no document-level horizontal scroll, correct `lang`.                                                   |

## What changed in this audit's PR

- Manifest: `lang: "es"` and a Spanish description.
- `index.html`: meta description and Open Graph tags (`og:locale es_AR`).
- Tests in `apps/web/src/manifest.test.ts` (written red first).

## Re-running the audit

```bash
docker compose -f deploy/web/docker-compose.yml up -d --build
# then drive http://localhost:8470/ with Playwright at 1180x820 and 390x844
```
