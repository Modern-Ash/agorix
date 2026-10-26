# Authorized Ori review lifecycle regression

This increment tests the composed authenticated review workflow from a synthetic persisted canonical project through Agorix deterministic execution, minimized evidence, Ori adapter test seam, server-issued ticket and learner rejection. It verifies that no repository writes occur and that missing trusted pedagogical context fails closed.

The integration suite is included in the cross-repository CI gate. It is not yet a production authenticated E2E: session and project repository are test fixtures, and Ori's external process is replaced by a test-only callback. Separate tests already exercise the real Ori process.

Remaining production gates: actual session middleware, active project persistence, real learning context, canonical world selection, and unmocked end-to-end browser journey. No public route activation or project writes. Base integration/ori.
