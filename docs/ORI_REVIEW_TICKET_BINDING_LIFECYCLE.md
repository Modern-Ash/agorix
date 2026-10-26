# Ori review ticket binding lifecycle

The canonical review workflow maintains an auxiliary in-memory ticket-to-project mapping used by the trusted revision callback. This increment bounds the mapping to 100 entries and expires mappings after the same five-minute window as the review registry. Terminal decisions continue removing their binding.

This is process-local state: it is not durable across restarts or horizontally scaled instances. Production deployment must either use sticky routing for a single instance or replace both ticket registry and auxiliary mapping with a shared, transactional, expiring store. Never treat the client ticket ID as a program revision.

Related Ori #18 #23 #28 #29. Target integration/ori. No public activation or program writes.
