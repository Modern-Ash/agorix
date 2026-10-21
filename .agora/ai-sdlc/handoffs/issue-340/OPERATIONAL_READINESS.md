# Issue 340 Operational Readiness

- Service `agorix-web` running on the Modern Ash host: `docker ps` shows healthy; healthcheck hits `/healthz`.
- Restart policy `unless-stopped`; port 8470 bound to 127.0.0.1 only; public ingress via the `modern-ash` Cloudflare tunnel to `agorix.modern-ash.com` (#341).
- Public check on 2026-10-20: `https://agorix.modern-ash.com/` 200 with new headers; manifest correct; `/sw.js` edge copy stale until expiry (follow-up in #341).
- Logs: `docker logs agorix-web`. Not covered yet: deploy script and version endpoint (#342), runbook (#343).
