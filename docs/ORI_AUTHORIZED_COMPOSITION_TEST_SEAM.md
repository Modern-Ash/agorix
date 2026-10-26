# Ori authorized review integration test seam

The authenticated review composition now accepts an optional test-only Ori runner, allowing identity, project selection, canonical workflow and decision handlers to be exercised without launching the external process. Production uses the real Ori adapter when no override is supplied.

Tests cover server-owned active-project identity and fail-closed guest access. This does not activate production review routes or replace the required session middleware, persistent repository and pedagogical evidence. Next: exercise an actual canonical persisted program through the full authorized composition, then unmocked browser tests.

Target: integration/ori.
