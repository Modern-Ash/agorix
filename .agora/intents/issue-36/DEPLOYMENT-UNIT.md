<!-- agora-ai-sdlc:construction/v1 -->

# Deployment Unit — issue-36

No new deployment target. `apps/web` remains a static Vite build; the
manifest, icon and service worker are static files served from `public/`
alongside the existing build output. No new server-side component, secret,
or environment variable was introduced. The service worker only caches
same-origin, already-public static assets — no new network dependency.
