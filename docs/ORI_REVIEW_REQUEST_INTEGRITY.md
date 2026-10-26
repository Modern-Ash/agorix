# Ori review HTTP request integrity

Agorix's account HTTP client already sends `x-agorix-request: 1` for state-changing requests. Ori proposal issuance and decision clients now follow the same contract, and both Tutor API POST routes reject requests missing that header. Tests cover browser headers, accepted HTTP fixtures and rejection when the header is absent.

This custom header is one layer of CSRF defense, **not a standalone guarantee**. Production must still enforce trusted Origin/Host, secure HttpOnly SameSite cookies, restrictive CORS, TLS, session rotation and real authorization. A malicious same-origin script can send this header, so XSS defenses remain essential.

The existing canonical AuthService resolver assumes a cookie name and nonrotating session semantics that have not been verified against the production Project API host. Do not activate review routes until that mismatch is resolved. Target integration/ori.
