# Issue 340 Risk Register

| Risk | Impact | Mitigation |
| --- | --- | --- |
| nginx `add_header` is dropped in `location` blocks that set their own headers. | Missing CSP on some responses. | Define headers via an include repeated in each location and test each path with curl. |
| Header drift between nginx.conf and securityHeaders.ts. | Silent security regression. | Automated parity test in the unit suite. |
| Stale service worker after deploy. | Learners keep an old app. | `no-cache` on sw.js and index.html; edge TTL handled in #341/#344. |
| Port 8470 published on all interfaces. | Unintended exposure. | Bind 127.0.0.1 in compose; verify with `ss`. |
| Replacing the temporary container causes brief downtime. | Short outage of the public URL. | Start compose service after stopping the temp container; accept seconds of downtime. |
