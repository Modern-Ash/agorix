# Evidence provenance and stale-project protection

The host supplies a trusted 64-character SHA-256 program revision and a bounded trace. Ori creates an evidence receipt after validating ordered steps and the exact expected step count. This receipt is deterministic metadata binding the reviewed proposal to the observed revision; it is **not** an attestation that the host executed the program honestly.

At acceptance time, the host must call `assertCurrentProgramRevision(receipt, currentRevision)` using a freshly calculated canonical project hash, revalidate the proposal and enforce learner approval. If the project changed, the host must reject the stale proposal.

Ori still has no project-write capability. The next integration belongs on Agorix `integration/ori` exclusively. Real runtime evidence and UI review E2E remain required.
