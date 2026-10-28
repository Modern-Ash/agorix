# MIG-04 real AuthService cookie HTTP acceptance

This test boots the shared PostgreSQL AuthService production composition, registers and signs in a real account, then sends both anonymous and authenticated cookie requests to the Ori review apply endpoint. The durable rollout policy is explicitly disabled, so neither request may apply a change. The test checks that the HTTP boundary does not accept a valid login as permission to bypass rollout governance.

The test does not yet assert successful propose/decision/apply. It also does not establish that the deployed browser login uses this cookie contract. Before closing #1007, connect the real web handlers and `main.ts`, then verify authorized flow, cross-owner denial, CAS conflicts and emergency disable in a production-like environment. Pilot remains disabled.
