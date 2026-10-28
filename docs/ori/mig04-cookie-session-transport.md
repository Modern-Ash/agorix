# MIG-04 cookie session transport

The explicit `startOriMig04PgCookieAuthenticatedRuntime` composition extracts a single `__Host-agorix-session` cookie and delivers rotated tokens using `Secure`, `HttpOnly`, `SameSite=Strict` and `Path=/`. Duplicate, invalid or oversized cookies are rejected; it does not accept identity headers.

**Deployment compatibility gate:** This cookie name and transport are a proposed server-side contract, not evidence that the existing Agorix web login uses it. Before wiring `main.ts`, the web login/session lifecycle must adopt the same cookie name and origin/TLS policy, and the AuthService account/session store must be shared with tutor-api. Session-ID rotation and active-project mapping still require lifecycle integration. Do not enable the pilot until those are verified.
