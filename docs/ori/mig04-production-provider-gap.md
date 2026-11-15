# MIG-04 production provider integration gate

The canonical PostgreSQL runtime now validates required host dependencies **before** allocating a connection pool. It constructs the project repository internally, so callers cannot substitute a second repository.

The remaining release blocker is not another PostgreSQL readiness test: `apps/tutor-api/src/main.ts` still starts the legacy TutorServer. The web application owns account/session state, while the tutor process has no verified deployment contract for obtaining that session or selecting the active project. Neither an identity header nor an environment flag is acceptable as a substitute.

To close #1007, establish a trusted cross-process session-token contract with rotation handling, a server-owned active-project lookup, a production learning-context provider and deployment wiring for the canonical runtime. Verify authorized HTTP propose/decision/apply and denied cross-owner requests against the canonical database. Keep the learner pilot disabled until the complete acceptance gate passes.
