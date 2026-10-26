# Ori learner review: server-owned revision authority

The experimental Web review widget no longer treats an opaque ticket UUID as a canonical program revision. The browser can display the proposal and send an accept/edit/reject intent; only the trusted server workflow decides whether the project revision is still current.

The API's decision status `stale` is authoritative for the UI. This removes a misleading client-side freshness comparison that always matched by construction. The UI does not apply program changes.

Production activation still requires authenticated identity, real project repository wiring, pedagogical context, a trusted world state, and Playwright E2E. Feature flags remain off by default. Related Ori #18 #23 #28 #29. Base integration/ori.
