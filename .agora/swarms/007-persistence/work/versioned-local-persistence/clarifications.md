---
schema: "agora/clarifications/v1"
swarm: "persistence"
work: "versioned-local-persistence"
created-at: "2026-09-22T22:32:22.778944Z"
last-run-input-sha256: "1c245bb5e26ee504738f7b7100c07b045b4ec0bdf5b6db8dfcc7e23cdc8b6745"
last-run-question-count: 6
last-run-unanswered-count: 0
last-run-by: "project:ai-runtime-2"
last-run-at: "2026-09-22T22:35:00.000000Z"
---

# Clarifications for versioned-local-persistence

| Question | Answer | Actor | Timestamp | Input SHA-256 |
| --- | --- | --- | --- | --- |
| What storage abstraction is required for browser-local persistence? | A `BrowserStorageAdapter` interface with `get(key)`, `set(key, value)`, `remove(key)`, `has(key)` methods. The default implementation uses `localStorage` with JSON serialization. The persistence package must remain React-free and usable in any browser environment. | project:product-owner | 2026-09-22T22:35:00Z | 1c245bb5e26ee504738f7b7100c07b045b4ec0bdf5b6db8dfcc7e23cdc8b6745 |
| What is the project schema and version format for local storage? | Projects are stored under a versioned schema key `agorix/project/v1`. Each stored project includes `{schemaVersion, program, metadata}` where metadata includes `createdAt`, `updatedAt`, `missionProgress`, and `hintLevel`. The canonical `ProjectProgram` from issue #12 is the only programming source of truth. | project:product-owner | 2026-09-22T22:35:00Z | 1c245bb5e26ee504738f7b7100c07b045b4ec0bdf5b6db8dfcc7e23cdc8b6745 |
| What does corruption-safe failure mean in practice? | On any read error (corrupted JSON, missing keys, schema mismatch), the persistence layer must throw a typed `PersistenceError` with a stable code, never silently return bad data. The corruption must be isolated to the affected project; other projects and the runtime must remain unaffected. | project:product-owner | 2026-09-22T22:35:00Z | 1c245bb5e26ee504738f7b7100c07b045b4ec0bdf5b6db8dfcc7e23cdc8b6745 |
| What is the migration strategy for schema changes? | Explicit migration functions registered per version pair (e.g., `v1→v2`). On load, if stored `schemaVersion` differs from current, migrations are applied in order. Unknown future versions must fail safely with a typed error, never auto-migrate. | project:product-owner | 2026-09-22T22:35:00Z | 1c245bb5e26ee504738f7b7100c07b045b4ec0bdf5b6db8dfcc7e23cdc8b6745 |
| What is the relationship between generated code and canonical state? | Generated textual code is never persisted as an independent authority. It is regenerated from the canonical `ProjectProgram` on demand. The editor state (visual blocks) and canonical program must round-trip without semantic drift. | project:product-owner | 2026-09-22T22:35:00Z | 1c245bb5e26ee504738f7b7100c07b045b4ec0bdf5b6db8dfcc7e23cdc8b6745 |
| Does the persistence package depend on React or any UI framework? | No. The persistence package (`@agorix/persistence`) must have zero React dependencies. It provides a pure storage abstraction layer usable from any runtime. | project:product-owner | 2026-09-22T22:35:00Z | 1c245bb5e26ee504738f7b7100c07b045b4ec0bdf5b6db8dfcc7e23cdc8b6745 |
