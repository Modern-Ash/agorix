# MIG-04 authenticated session rotation reconciliation

`createOriMig04SessionRotationGuard` reconciles an already verified AuthService session transition with the durable PostgreSQL session-project lifecycle. A cross-owner transition is denied. When rotation fails, the previous mapping is revoked on a best-effort basis and the guard returns false so the caller can deny the request.

The guard is not a token verifier and must only receive identities produced by trusted AuthService resolution. The deployed middleware must invoke it at the actual token rotation boundary and deny requests on false. This PR does not connect the web session provider or enable the pilot.
