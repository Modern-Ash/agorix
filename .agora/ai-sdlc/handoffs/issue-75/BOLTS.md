# Suggested Bolts - issue #75

## Bolt 1: Shared protocol and validation

Implement proposal schema, parser/validator, base hash check, bounded operations and candidate program computation.

## Bolt 2: Preview, decision and audit helpers

Implement structured diff/preview, affected mapping hooks, reject/accept/modify decisions and audit/event records without PII.

## Bolt 3: Surface integration

Adapt Studio to shared semantics and add Web/Tablet proposal card view-model helpers using the same fixture.

## Bolt 4: Verification

Add deterministic tests, run full checks, record evidence and prepare PR.

Bolts are sequential because surface integration should depend on the shared protocol tests.
