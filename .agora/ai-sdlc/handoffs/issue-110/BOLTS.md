## Suggested Bolts

- BOLT-110-A: Architecture decision and catalog foundation
  - Depends on: approved Inception.
  - Produces: i18n ADR, locale registry, catalogs, fallback and missing-key validation.

- BOLT-110-B: First Mission and curriculum resources
  - Depends on: BOLT-110-A.
  - Produces: localized curriculum APIs/resources and tests.

- BOLT-110-C: Learner UI locale selection and localized app surfaces
  - Depends on: BOLT-110-A and BOLT-110-B.
  - Produces: selectable EN/ES UI, localized current journey, proposal review, execution evidence, run controls, and persistence behavior.

- BOLT-110-D: Learning Companion locale behavior
  - Depends on: BOLT-110-A.
  - Produces: deterministic EN/ES fake responses, provider locale propagation, and machine-readable field safeguards.

- BOLT-110-E: Evidence, docs, and final verification
  - Depends on: BOLT-110-B, BOLT-110-C, and BOLT-110-D.
  - Produces: README parity, contributor guide, screenshots/evidence, canonical hash comparison, and repository verification.
