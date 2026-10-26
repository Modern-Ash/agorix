# Ori active-project session lifecycle

This increment adds trusted server-side hooks to migrate an active-project selection when a session ID changes, and to clear the selection on sign-out. The tests use the real SQLite persistence adapter. Cross-account migration is denied.

The migration currently uses read/write/delete operations and is **not atomic** across failures. A production multi-instance implementation must use a single transaction, handle concurrent session rotations and ensure stale session IDs cannot retain access. The hooks are not yet wired to the actual authentication middleware or logout route. For AuthService implementations that preserve sessionId across token rotation, no migration is needed.

This PR does not activate the Ori review routes. Remaining work: production session/project store composition, real pedagogical context and unmocked browser E2E. Target integration/ori.
