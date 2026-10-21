# Issue 340 Rollback Procedure

1. `git checkout <previous-sha>` in the repository.
2. `docker compose -f deploy/web/docker-compose.yml up -d --build`.
3. Verify with `curl -sI localhost:8470/healthz` and the public URL.
Emergency stop: `docker compose -f deploy/web/docker-compose.yml down` (the site returns 404 from the tunnel until restarted). Scripted rollback arrives in #342.
