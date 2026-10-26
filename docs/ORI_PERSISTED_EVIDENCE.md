# Persisted program evidence for Ori v2

This server-only resolver loads an owner-scoped canonical project through ProjectRepository, invokes a supplied canonical Agorix execution port, and emits a bounded trace of operation categories. Raw node IDs, world state, source code and learner text are excluded. It re-reads the project after execution and refuses evidence when either the semantic hash or numeric repository revision changed.

The execution and learning-context callbacks MUST be supplied by trusted server code. In particular, attempts and hints must be backed by real pedagogical evidence, not fabricated values. The resolver does not grant authority to browser-provided projects, identities or execution traces.

This is a composition seam, not yet a deployed end-to-end integration. Next: implement a concrete canonical execution port, connect the authorized project service and expose an authenticated review workflow. No project writes are included. Agorix base branch: integration/ori.
