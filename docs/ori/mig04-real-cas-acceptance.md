# MIG-04 real PostgreSQL fenced CAS acceptance

This regression runs against an isolated PostgreSQL 16 CI service for pull requests targeting `integration/ori`.

The test exercises the **production CAS primitive**, not a standalone revision update:

- Two independent transactions contend on the same policy row and project revision.
- Exactly one commit returns `applied`; the other returns `conflict`.
- The project revision advances exactly once, preserving the committed semantic hash.
- A durable emergency revocation increments the policy epoch.
- A subsequent attempt with the previous epoch is `denied` without modifying the project.

This verifies the database-level authorization and write boundary. It does **not** establish that the production `main.ts` has authenticated session and repository infrastructure wired. That remains a separate release gate under #1007. Do not enable learner rollout based solely on these tests.
