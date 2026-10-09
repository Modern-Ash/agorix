# @agorix/persistence

Versioned project storage abstraction and portable Agorix project interchange.

Domain package: must not import React, Blockly, Phaser, Capacitor, VS Code APIs or
provider SDKs (see `AGENTS.md` architecture invariants and
`docs/architecture/SYSTEM_DESIGN.md`).

## Portable `.agorix` v1

The portable project artifact is UTF-8 JSON with extension `.agorix` and media
type `application/vnd.agorix.project+json`. It is deliberately
human-inspectable and versioned independently from the canonical program schema:

```json
{
  "format": "agorix-project",
  "formatVersion": "1",
  "exportedAt": "2026-01-02T03:04:05.000Z",
  "project": {
    "schemaVersion": "agorix/program/v1",
    "program": {},
    "metadata": {
      "createdAt": "2026-01-01T00:00:00.000Z",
      "updatedAt": "2026-01-02T00:00:00.000Z",
      "missionProgress": 0,
      "hintLevel": 0,
      "locale": "es-AR"
    }
  }
}
```

`project.program` is the canonical `ProjectProgram`. Portable metadata includes
only progression needed to continue (`missionProgress`, `hintLevel`), timestamps,
`locale` when present as the existing portable user preference, the learner
`missionSpec`, and the shared creative state owned by `ProjectCreativeState`.

The creative state is persisted in metadata for v1 instead of being embedded
directly into `ProjectProgram`: scripts remain executable code, while actors,
stage and assets are project context consumed by both Agorix App and Agorix
Studio. The persistence boundary validates that context through
`@agorix/program-model` before export, import, semantic hashing or cross-surface
compatibility checks. Broken references such as an actor costume id without a
matching costume asset, a stage actor order entry without an actor, or a sound
statement without a sound asset fail closed.

The v1 reader fails closed: it checks the byte limit before parsing, parses JSON
only, rejects unknown `formatVersion`, rejects unsupported project
`schemaVersion`, validates the canonical program, and applies the cross-surface
compatibility guard. Account/session/owner/revision/history/secrets/logs and
telemetry fields are not part of the envelope.

Format migrations are independent from program schema migrations. A future
`formatVersion` must be handled by an explicit reader/migration path; v1 must
not silently coerce unknown future versions. The committed v1 fixture is
`fixtures/v1/minimal.agorix.json`.
