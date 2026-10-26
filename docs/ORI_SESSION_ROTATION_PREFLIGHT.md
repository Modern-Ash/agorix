# Ori session rotation preflight

The canonical AuthService may rotate and revoke a session token during resolveSession. The Ori adapter now checks that a writable HTTP response is present **before** invoking AuthService, preventing token consumption when no replacement cookie can be sent. The regression test verifies the authentication backend is not called for missing or already-sent responses.

This does not solve concurrent requests using the same rotating cookie: the Web account client serializes requests, but the independent Ori HTTP clients currently do not share that queue. Production activation remains blocked until requests share the session-rotation queue or the account host provides a safe coordinated session strategy. Actual cookie name, shared storage and active-project persistence also remain unresolved.

No public endpoint activation. Target integration/ori.
