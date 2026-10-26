# Cross-tab rotating-session coordination

Agorix account/project requests and Ori proposal/decision requests share the existing in-tab queue. When the browser supports the Web Locks API, the queue now obtains an exclusive same-origin lock named `agorix-auth-session-rotation` for each request. This serializes cooperating tabs and reduces concurrent reuse of a token invalidated by AuthService rotation.

The lock is released on success or failure. Existing in-tab serialization remains the fallback for browsers without Web Locks or in non-browser tests. The fallback **does not coordinate tabs** and must not be treated as production-safe for rotating sessions. Production must verify browser support and use a server-side concurrency-safe session strategy where Web Locks are unavailable. Web Locks do not coordinate different browsers/devices, and only work when all participating clients use this shared queue.

This increment does not enable the Ori review endpoints. Cookie name, shared session/project persistence, active-project selection and unmocked production E2E remain release gates. Target `integration/ori`.
