# Issue 340 Deployment Unit

- Image `agorix-web:local` built from `deploy/web/Dockerfile` (repo root context).
- Service `agorix-web` via `deploy/web/docker-compose.yml`, `restart: unless-stopped`, `127.0.0.1:8470`.
- Rollback: `docker compose` with the previous image tag (automation arrives in #342).
- Edge: Cloudflare cache purge/rule for `/sw.js` is tracked in #341.
