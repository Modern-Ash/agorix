# MIG-04 P0 consolidated closeout

Tracks #1007, #1008, #1009. Target: `integration/ori` only.

## Delivery gates

1. Wire PostgreSQL transaction pool, trusted server-side policy/epoch and authenticated session to the approved-review atomic CAS path. Reject missing providers; never fall back to unfenced project writes.
2. Exercise real PostgreSQL with two independent connections: concurrent CAS, stale revision and epoch, rollback racing apply, revoked allowlist and kill switch. Assert no partial writes.
3. Run isolated PostgreSQL integration tests in CI together with TypeScript, build, formatting and existing regression checks. Capture repeatable evidence.
4. Keep rollout disabled by default. Production enablement and educator approval are out of scope.

## Review rule

Do not mark ready or merge until all three issues are implemented and CI is green. This planning commit alone is not implementation evidence.
