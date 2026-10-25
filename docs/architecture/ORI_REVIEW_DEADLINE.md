# Ori review request deadline

This internal helper adds a bounded deadline to the existing 512-byte streaming body parser. It accepts a Node `IncomingMessage`, a configurable deadline (default 1000 ms, maximum 10 seconds) and an optional external `AbortSignal`.

If the deadline expires or the external signal aborts, it aborts parsing and destroys the request stream to interrupt a stalled async iterator. Successful, complete requests retain the strict input schema and byte cap.

## Tradeoffs and release gates

Destroying an `IncomingMessage` can close the client connection, so a future HTTP route must choose and test its response semantics for timeouts and disconnects. This helper is intentionally **not wired into the main server or review pipeline yet**. The next integration increment must connect request close/abort events, response cleanup and end-to-end timeout tests before enabling any endpoint.

No Kids behavior, public route, persistence or model configuration changes are introduced.
