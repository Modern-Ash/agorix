# MIG-04 AuthService rotation and project mapping

AuthService now returns the verified previous session identifier only when a session token is rotated. The Ori resolver requires the durable mapping rotation callback to succeed **before** emitting a replacement secure cookie. Missing previous identity, missing callback, failed migration or cookie delivery deny the request.

The cookie-backed runtime explicitly requires the PostgreSQL session-project lifecycle and uses the existing fail-closed rotation guard. The previous session identifier is taken from AuthService's session repository, never from browser-supplied headers.

This closes a composition gap, not the deployment gate: the web login and tutor-api still need a shared AuthService session store, trusted cookie compatibility, and actual main.ts wiring. No pilot activation is introduced.
