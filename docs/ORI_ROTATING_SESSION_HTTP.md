# Ori rotating session HTTP boundary

The review identity callback now receives the HTTP response so the canonical AuthService resolver can propagate a rotated token as a secure HttpOnly SameSite cookie. When the session rotates but there is no writable response, authorization fails closed. Existing Set-Cookie headers are preserved. The cookie name is configurable to match the actual account host; Secure is the default.

This remains an integration adapter, not a production activation. The real Project API cookie name, Path, SameSite policy, token format, session storage and reverse-proxy behavior must be verified before use. The optional insecure cookie setting is for loopback tests only. Production must use TLS and shared account/session storage. The review routes remain disabled in main.ts.

Related Ori #18 #23 #28 #29. Target integration/ori.
