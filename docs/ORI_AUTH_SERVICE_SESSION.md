# Ori canonical AuthService session resolver

This adapter reads an `agorix_session` cookie and resolves it through the canonical `@agorix/auth-service` AuthService. It rejects missing, duplicated, malformed, expired, revoked, mismatched or rotated sessions. Only the authenticated accountId and sessionId are returned; no project identity is accepted from browser fields.

**Production prerequisite:** the actual Agorix account host must issue this exact secure HttpOnly SameSite cookie (or the adapter must be updated to its real cookie contract). The AuthService instance must share durable account/session storage with that host. The resolver assumes non-rotating read-only resolution; if sessions rotate, use middleware that can propagate the new cookie safely. Never disable session rotation solely to make this adapter work.

This PR does not enable the Ori review routes in main.ts. The server still needs trusted active-project selection, project persistence, pedagogical context and CSRF protections. No automatic project writes. Target integration/ori.
