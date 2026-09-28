---
schema: "agora/artifact/v1"
kind: "implementation-plan"
swarm: "persistence"
work: "versioned-local-persistence"
---

# Implementation Plan

## Scope

Complete issue #28 by validating and recording the existing persistence slice:

- versioned project document shape;
- browser-local storage adapter;
- explicit migration registry;
- typed persistence errors;
- web reload integration;
- generated-code regeneration from canonical state;
- no React dependency in the persistence package;
- no child PII fields in stored metadata;
- unit and integration test coverage.

## Implementation References

- `packages/persistence/src/store.ts`
- `packages/persistence/src/index.ts`
- `packages/persistence/src/index.test.ts`
- `apps/web/src/projectStorage.ts`
- `apps/web/src/editorModel.ts`
- `apps/web/src/App.test.tsx`

## Construction Steps

1. Confirm `ProjectStore` stores `schemaVersion`, canonical `program`, and
   `metadata`.
2. Confirm migration and unknown-version behavior.
3. Confirm web storage does not persist generated code.
4. Confirm reload reconstructs visual blocks and regenerates text projection.
5. Confirm package dependencies do not include React.
6. Run the deterministic test suite and record `test-suite` evidence.
