# Ori v2 learner proposal journey — integration/ori

This vertical slice introduces a review-only proposal lifecycle and a browser component for structured Ori `move`/`turn` proposals. It does **not** expose the server-only host evidence adapter as a browser endpoint and does **not** modify a program. The buttons record only a local UI decision; they are not yet wired to a trusted server decision API.

The server review session requires an evidence receipt and checks a current host-provided program revision before recording accept/edit/reject. The browser component displays stale-revision warnings, but its client-side check is not an authorization boundary.

Next integration gate: build evidence on the trusted Agorix server from canonical program execution, expose a server-owned proposal identifier (never grants or raw trace from the browser), revalidate the revision and proposal on every server decision, and implement a separate authorized project mutation after explicit learner approval.

Related Ori issues: #16, #17, #18, #20, #28. Agorix base branch: `integration/ori` exclusively.
