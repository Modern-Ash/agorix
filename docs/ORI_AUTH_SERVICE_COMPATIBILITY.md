# Ori canonical AuthService compatibility test

This integration test uses the real `@agorix/auth-service` implementation with in-memory account and session repositories. It registers a learner, signs in, resolves the resulting token through the Ori cookie adapter, signs out, and verifies that the revoked session no longer resolves.

The test explicitly configures `rotateOnResolve:false` only for this isolated fixture. It does not establish that production uses this cookie name or nonrotating sessions. Production must preserve its actual session policy and implement cookie rotation safely where required.

The test is included in the Ori interoperability CI gate. This is not production authentication activation: main.ts still does not enable the review endpoints. Next: align the real web-host session cookie and shared account/session store, then connect active-project persistence and run unmocked browser E2E. Target integration/ori.
