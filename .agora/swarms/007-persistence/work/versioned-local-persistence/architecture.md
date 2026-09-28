---
schema: "agora/artifact/v1"
kind: "architecture"
swarm: "persistence"
work: "versioned-local-persistence"
---

# Architecture

The persistence architecture keeps canonical program state independent from the
web editor shell.

## Packages

- `packages/persistence`: platform-neutral persistence package.
- `apps/web/src/projectStorage.ts`: web integration adapter over browser
  `Storage`.
- `apps/web/src/editorModel.ts`: reconstructs visual workspace and generated
  code from canonical `ProjectProgram`.

## Data Flow

1. The editor produces a canonical `ProjectProgram`.
2. `saveEditorProject` stores only `program` and `metadata`.
3. Generated textual code is not stored.
4. `loadEditorProject` loads the canonical program.
5. `createEditorModelFromProgram` rebuilds visual blocks and regenerates code.

## Migration Boundary

`ProjectStore` accepts explicit `MigrationStep` entries. A stored project whose
version does not match the current schema must have a registered migration from
`fromVersion` to `toVersion`; otherwise it fails safely with `UNKNOWN_VERSION`.

## UI Independence

`@agorix/persistence` depends only on `@agorix/program-model`. React remains in
the web app package and does not enter the persistence boundary.
