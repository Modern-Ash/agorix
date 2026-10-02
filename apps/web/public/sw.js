/**
 * Minimal app-shell service worker (issue #36, AC-001: PWA installability).
 *
 * Precaches the app shell on install, then serves same-origin GET requests
 * network-first with a cache fallback so the shell keeps working offline
 * after the first successful load — matching the "deterministic runtime and
 * app shell available offline" requirement without any provider/network
 * dependency (issue #96's offline mode governs AI-only behavior, not the
 * app shell itself).
 */
const CACHE_NAME = "agorix-shell-v4";
const APP_SHELL = [
  "/",
  "/manifest.webmanifest",
  "/icons/agorix-mark.v2.svg",
  "/favicon.v2.svg",
  "/brand/agorix-logo.v2.svg",
  "/brand/agorix-logo-header.v2.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) {
    return;
  }
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached ?? Response.error())),
  );
});
