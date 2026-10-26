# Ori v2 canonical project review service

This server-only orchestration layer composes project authorization, host evidence, Ori v2 and the review-ticket registry. It checks the project owner, evidence revision, Ori receipt revision, and performs a second authorized project lookup after the asynchronous Ori call before issuing a ticket. No browser-supplied grants, traces, hashes or program content are accepted here.

The `resolveProject` callback must be implemented by a trusted Agorix project repository and canonical execution service. The `runOri` callback uses the existing server-only Ori host evidence adapter. The registry's `currentRevision(ticketId)` callback must independently resolve the canonical project revision from server-side ticket metadata; never use a client-supplied revision. This PR does not implement those production adapters.

The read method is not an authorization endpoint and must not be exposed to HTTP without checking authenticated project access. No public route, UI mount, or program mutation is included. Next milestone: wire canonical project persistence and server-authenticated session context, then E2E review. Ori issues #16 #17 #18 #23 #28. Agorix target branch `integration/ori`.
