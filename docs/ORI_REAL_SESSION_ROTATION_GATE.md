# Real rotating AuthService session continuity

This integration test uses the canonical AuthService with its default session rotation policy, registers a learner, signs in, resolves the cookie through Ori middleware, verifies that a secure replacement cookie is issued, confirms the previous token is rejected and verifies that the replacement token can be used on a subsequent request.

The test is added to the cross-repository Ori interoperability gate. It does not prove the production host uses the same cookie name, Path or SameSite settings. It also uses in-memory account/session repositories rather than production storage. Review endpoints remain disabled in main.ts until actual cookie contract, durable shared storage and active-project selection are connected.

Related Ori #18 #23 #28 #29. Base integration/ori.
