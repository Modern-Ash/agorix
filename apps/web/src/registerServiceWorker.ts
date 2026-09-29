/** Registers the app-shell service worker (issue #36, AC-001). No-op where unsupported (e.g. jsdom tests). */
export function registerServiceWorker(): void {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Installability degrades gracefully: the app remains fully usable without an active service worker.
    });
  });
}
