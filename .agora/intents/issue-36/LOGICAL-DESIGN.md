<!-- agora-ai-sdlc:construction/v1 -->

# Logical Design — issue-36

## Service worker fetch strategy: network-first, not cache-first

A network-first strategy (`fetch(request).then(cache.put).catch(() => caches.match(request))`)
was chosen over cache-first so a learner online after a new deploy always
gets the current build; cache-first would strand them on a stale shell
until the cache is manually busted. The tradeoff is that a normal (online)
navigation is not faster from cache — acceptable for a POC where "offline
still works" matters more than shaving network latency on every load.

## Precache list vs. runtime caching

`APP_SHELL` in `sw.js` only lists `/`, `/manifest.webmanifest`, and the
icon — not the hashed JS/CSS bundle filenames Vite generates at build time
(unknown to a hand-written `public/sw.js`). Those are captured by the same
`fetch` handler's runtime `cache.put` as the page requests them on first
load. This is why the offline-shell Playwright test explicitly reloads the
page once (with the SW already active) before going offline: that ensures
every asset the page actually requests has been through the fetch handler
at least once.

## Icon format: SVG only, no PNG

No image-conversion tooling was available in this environment
(`imagemagick`/`rsvg-convert`/`Pillow`) to hand-produce correctly-encoded
PNGs. `image/svg+xml` manifest icons are valid per the Web App Manifest
spec and supported by Chromium's install/installability path. If Lighthouse
or a specific target platform later requires a raster PNG icon, add one
(recommended: 192x192 and 512x512 `image/png`) as a follow-up — this is a
real, disclosed gap, not silently worked around.
