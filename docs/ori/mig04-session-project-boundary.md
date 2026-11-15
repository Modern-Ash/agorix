# MIG-04 trusted session-to-project boundary

The canonical authenticated runtime now has an explicit server-owned active-project lookup contract, keyed by verified account and session identifiers. Browser-provided project identifiers or identity headers cannot select the active project.

The adapter fails closed on malformed session/project identifiers, missing projects and store errors. The existing canonical repository independently verifies ownership.

This is a composition boundary, **not** an implementation of a deployed session-project store. The web application and tutor-api still require a verified cross-process authentication/session integration before production `main.ts` can use this runtime. No pilot activation is introduced. Do not close #1007 based solely on this adapter.
