# Real HTTP session rotation regression

This test starts the actual Tutor API HTTP server with a canonical AuthService backed by isolated in-memory repositories. It signs in a learner, calls the review decision route with the issued session cookie, verifies the replacement Set-Cookie, rejects reuse of the invalidated token, and accepts the next request with the rotated token. The route's decision handler is a test fixture; no project writes occur.

The test is included in the cross-repository Ori CI gate. It does not enable the review routes in production or establish the real account host's cookie name, session storage, active project selection, CSRF deployment policy, or a fully unmocked project-to-Ori journey.

Target branch: integration/ori.
