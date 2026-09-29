<!-- agora-ai-sdlc:deterministic-inception/v1 -->

# Risk Register — issue-36

| Risk | Impact if unmitigated | Mitigation |
| --- | --- | --- |
| Service worker caches a stale app shell forever | Learner stuck on an old build after a deploy | Network-first fetch strategy (not cache-first); `activate` deletes any cache not matching the current `CACHE_NAME`, which is bumped on shell changes |
| Service worker breaks the app when registration fails (unsupported browser, blocked) | App becomes unusable | `registerServiceWorker` no-ops when `serviceWorker` is unsupported and swallows registration rejection |
| Precache list omits hashed build assets | Offline reload shows a blank shell | Runtime `fetch` handler caches every successful same-origin GET as it's requested, not only the static precache list; covered by the new offline-shell Playwright test |
| CSP regresses to allow a wider `worker-src`/`manifest-src` | Security baseline weakened | No CSP directive was changed; `node scripts/security-baseline.mjs` re-run and passing |
