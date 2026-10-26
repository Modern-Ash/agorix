# Ori composed runtime HTTP authorization gate

This test starts the real Tutor API HTTP server using `openOriReviewRuntime` options, a canonical AuthService instance and the SQLite active-project composition. It sends an unauthenticated proposal request and verifies HTTP 401 without invoking the Ori adapter.

This tests the integration boundary and fail-closed behavior, not a fully authenticated learner-to-Ori journey. The ProjectRepository and Ori runner are fixtures, and the review endpoints remain disabled in main.ts. Production activation requires the existing account host's session/project stores, active-project selection endpoint, trusted pedagogical context and unmocked browser E2E.

The test is included in the Ori interoperability CI gate. Target integration/ori.
