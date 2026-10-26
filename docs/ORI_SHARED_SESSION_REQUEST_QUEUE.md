# Shared rotating-session request queue

The Agorix Web account/project HTTP client and both Ori review clients now share one in-process promise queue. Requests using the same rotating HttpOnly session cookie are serialized, preventing overlapping browser calls from presenting the same token. Rejected calls do not poison the queue. Unit tests cover ordering and recovery.

This is a per-tab JavaScript queue, **not** cross-tab synchronization or distributed server session coordination. Production still requires verifying the actual cookie name, Path, session storage, reverse-proxy behavior and active-project persistence. For multiple browser tabs, implement a coordinated session strategy or server-side concurrency-safe rotation. Ori review endpoints remain disabled by default.

Target integration/ori.
