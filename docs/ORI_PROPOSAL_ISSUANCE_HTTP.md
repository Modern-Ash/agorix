# Ori authenticated proposal issuance (experimental)

Adds POST /api/tutor/ori/review/propose. The endpoint accepts an empty JSON object only. It derives the owner and project from a trusted server-side identity resolver, invokes the injected canonical proposal workflow, and returns a server-issued opaque ticket and bounded proposal. It is disabled by default and never accepts browser-provided program, grants, project identity or revision.

Production wiring is **not included**. The application must supply authenticated identity middleware, canonical project repository, verified learner context, trusted world state, and the Ori CLI workflow before enabling the endpoint. The browser must not manufacture a proposal ticket. This route records no program changes.

The CI gate includes loopback HTTP tests for authenticated issuance, guests, disabled mode, forged authority and cross-origin requests. Next: authenticated production composition, browser ticket client, UI mount and Playwright end-to-end tests. Agorix base integration/ori.
