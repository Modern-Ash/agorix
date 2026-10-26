# Ori active project persistence contract

The multi-project selector can now use an expiring `OriActiveProjectStore` backed by an injected persistence port. Records are scoped to accountId and sessionId, include an expiration timestamp, and are invalidated on expiry, mismatch or explicit clear. The default TTL is 30 minutes.

The persistence port is an abstraction: this PR does **not** provision a database, create a SQL schema or wire production storage. The production implementation must use transactional shared storage with expiry cleanup, revoke selections on logout, and reconcile session rotation. The canonical ProjectRepository still verifies ownership on each selection and read.

Tests cover expiry, account/session isolation, explicit cleanup and mismatched records. Related Ori #18 #20 #23 #28 #29. Base integration/ori.
