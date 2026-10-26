# Ori session migration must be atomic

Session-ID migration now requires an explicit transactional persistence capability. The previous generic read/write/delete fallback could copy a selection to a new session and fail before deleting the old one, leaving both session IDs active. The lifecycle now fails closed when the persistence adapter lacks `migrate`.

SQLite implements transactional migration. Tests verify that nontransactional adapters cannot migrate or write selections. This is a correctness and authorization hardening step, not production activation.

The actual authentication/logout event hooks, shared production session/project store, cookie contract and unmocked browser journey remain release blockers. Base integration/ori.
