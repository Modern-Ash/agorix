# Suggested Bolts - issue #76

## Bolt 1: Shared Step contract

Add deterministic step-sequence helpers over runtime observations/traces, including current node id, statement type, before/after world state, frame mapping and documented timing metadata.

## Bolt 2: Web Step behavior

Update the Web app so Step uses the shared contract, cannot race with Run, clears on edit/reset, preserves state through viewport changes and synchronizes block/code/stage from one node id.

## Bolt 3: Studio parity

Adapt Studio execution evidence to expose the same step sequence and inspector rows from the shared contract.

## Bolt 4: Verification

Add simple/repeat/conditional tests, narrow layout/touch evidence, full repository verification and Agora evidence.

Bolts are sequential because the Web and Studio surfaces must depend on the same shared Step contract.
