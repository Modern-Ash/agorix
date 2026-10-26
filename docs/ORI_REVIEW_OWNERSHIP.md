# Ori proposal review ownership boundary

Every server-side review ticket is bound to an owner identifier supplied by trusted session middleware. The registry refuses reads and decisions from a different owner, while retaining expiry, concurrency protection and non-applying decisions.

**Do not accept the owner identifier from a browser request body, query string or arbitrary header.** The next integration step must establish authenticated project/session ownership on the Tutor API and map the authenticated principal to a canonical project revision. Until then, do not expose this registry through HTTP.

This is a server-only authorization primitive, not proof of authenticated session ownership. No program mutation or public route is included. Related Ori issues #18 #23 #28. Agorix base: `integration/ori`.
