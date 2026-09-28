---
schema: "agora/artifact/v1"
kind: "domain-model"
swarm: "persistence"
work: "versioned-local-persistence"
---

# Domain Model

Issue #28 persists learner projects through a platform-neutral storage boundary.

## StoredProject

- `schemaVersion`: current canonical program schema version.
- `program`: the canonical `ProjectProgram`; this is the only program source of truth.
- `metadata`: project metadata required by the POC.

## ProjectMetadata

- `createdAt`
- `updatedAt`
- `missionProgress`
- `hintLevel`

No child PII fields are part of the persistence document.

## Storage Boundary

`BrowserStorageAdapter` defines the platform boundary:

- `get(key)`
- `set(key, value)`
- `remove(key)`
- `has(key)`

`ProjectStore` depends on this adapter, not on React or browser UI code.

## Failure Model

Persistence failures are typed as `PersistenceError` with stable codes:

- `STORAGE_UNAVAILABLE`
- `CORRUPTED_DATA`
- `SCHEMA_MISMATCH`
- `UNKNOWN_VERSION`
- `MIGRATION_FAILED`
- `SERIALIZATION_ERROR`

Unknown future versions fail with `UNKNOWN_VERSION`; corrupted JSON fails with
`CORRUPTED_DATA`.
