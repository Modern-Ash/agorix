# Ori SQLite project selection composition

`openOriSqliteProjectSelection` connects the existing SQLite persistence, expiring store, authenticated project selector and transactional session lifecycle into a single-host resource. It exposes choose, activeProject, rotated, signedOut and close, with cleanup on initialization failure.

Tests cover selection, session-ID rotation, old-session invalidation, logout and unauthorized projects using the actual SQLite adapter. This composition is **not** yet connected to main.ts or the production authentication event stream; doing so requires confirming the real Project API cookie contract, account/session store and shared canonical ProjectRepository instance.

For distributed deployment, replace SQLite with a shared transactional store. Do not enable Ori endpoints until authenticated browser-to-Ori E2E is verified. Target integration/ori.
