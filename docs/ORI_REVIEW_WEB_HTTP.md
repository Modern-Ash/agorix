# Ori v2 browser review HTTP integration

The review component now has a same-origin HTTP decision client for the opt-in Tutor API route. The client submits only an opaque ticketId and learner decision, uses same-origin credentials, validates the server's response, and fails closed on network errors or unauthorized requests.

**Not yet activated in the main UI:** the production server route is disabled until trusted authentication, project ownership, and the canonical review workflow are wired. The component still requires a server-issued proposal ticket and a project revision; it must never manufacture them in the browser. This PR does not add automatic project writes.

Next vertical increment: authenticated server ticket issuance, mounting the review component with server-issued tickets, and Playwright E2E for approve/edit/reject, stale revisions, unauthorized users and offline behavior. Related Ori #18 #20 #23 #28 #29. Base branch integration/ori.
