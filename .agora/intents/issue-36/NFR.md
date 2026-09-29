<!-- agora-ai-sdlc:deterministic-inception/v1 -->

# Non-Functional Requirements — issue-36

- No new provider credentials, network dependency, or CI-only external call: the service worker only precaches same-origin, already-shipped static assets.
- Manifest and service worker must respect the existing strict CSP (`worker-src 'self'`, `manifest-src 'self'`) without loosening it.
- The service worker degrades gracefully: registration failure must not block or break the app.
