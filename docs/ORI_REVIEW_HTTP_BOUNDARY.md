# Ori v2 authenticated review decision route

This opt-in Tutor API route is disabled by default. To enable it, trusted server composition must supply all three options: oriReviewEnabled, oriReviewIdentity, and oriReviewDecision. No production identity resolver is provided here; main.ts does not enable this route.

POST /api/tutor/ori/review/decision accepts only an opaque UUID ticketId and one of accept/edit/reject. The server resolves ownerId and projectId from authenticated middleware, checks same-origin, JSON content type and rate limits, and returns only a final review status with appliedChanges=false. It never accepts client-provided owner, project, grants, program or revision. The injected decision callback must use the canonical workflow and check project authorization and revision.

This is not an endpoint for applying program changes. Production rollout requires authenticated identity integration, CSRF protection appropriate to session cookies, route-level HTTP tests, browser wiring and end-to-end acceptance tests. Related Ori #18 #23 #28 #29. Target branch integration/ori.
