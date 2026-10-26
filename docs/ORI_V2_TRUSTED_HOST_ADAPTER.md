# Ori v2 trusted host evidence adapter

This experimental **server-only** adapter calls the independent Ori `examples/host-evidence-cli.mjs` using a validated host-owned envelope. It requires a 64-character canonical program revision, complete ordered trace, explicit read grants, and bounded snapshots. Ori returns a proposal plus evidence receipt; neither Ori nor this adapter writes to the program.

**Security boundary:** never expose this adapter as an endpoint that accepts browser-supplied grants, revision or trace. A subsequent Agorix implementation must build the envelope from the trusted canonical runtime and server-controlled authorization, then recompute revision and revalidate proposals at accept/edit/reject time. A digest does not attest that the host executed honestly.

The cross-repo gate now includes `oriHostEvidenceLive.test.ts`. The live test is skipped when Ori is absent; the gate requires `ORI_REPO_PATH` and the Ori CLI, so its CI run must execute rather than skip the scenario. No child-facing activation or UI changes are included.

Agorix PRs target `integration/ori` only.
