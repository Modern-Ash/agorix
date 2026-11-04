# Host evidence bridge — Ori v2 (experimental)

The host owns execution, evidence, grants, and the canonical program revision. Ori receives a strictly bounded envelope with an allowlisted intent, hostContext, allowed block kinds, ordered trace summaries, expectedSteps and a 64-character revision hash. The CLI accepts JSON on stdin and returns only a plan, optional validated proposal and evidence receipt. It never writes to the host.

The trusted host MUST compute the revision itself, enforce permissions, redact raw learner data and recheck revision + proposal validity at accept/edit/reject time. The receipt is not cryptographic proof of execution. This example is a contract seam, not a production child-facing API or a sandbox.

`node --test test/host-evidence-bridge.test.mjs`

Next: Agorix adapter and real canonical-run acceptance tests exclusively on `integration/ori`. No changes to Agorix main/develop.
