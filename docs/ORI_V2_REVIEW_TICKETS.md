# Ori v2 server-owned review tickets

This increment introduces a bounded in-memory review registry. A trusted server component supplies a validated Ori proposal and evidence receipt. The registry creates an opaque UUID ticket; no host grants, raw trace, program revision or learner text is required from the browser. It limits active tickets, expires them after five minutes by default and permits one terminal review decision.

**Critical trust boundary:** `currentRevision(id)` must be implemented on the trusted server from the current canonical project revision. Never implement it from a request body or browser-provided hash. A review decision is an audit-only state transition, not a project write. The component is not wired to public routes, project storage or the student UI yet.

The next functional slice must establish trusted project/session ownership and server-derived evidence before mounting the review UI. Do not accept user-supplied host grants or evidence as authoritative. A separate authorized mutation path will require explicit learner approval, canonical program validation, optimistic concurrency and a rollback/undo strategy.

Related Ori issues: #16 #17 #18 #20 #23 #28. Target Agorix branch: `integration/ori` only.
