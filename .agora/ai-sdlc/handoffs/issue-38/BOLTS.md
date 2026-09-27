# Suggested Bolts

## Bolt 1: Studio Architecture and Package Skeleton

Add Studio architecture docs and workspace package scaffolding for `extensions/vscode`.

## Bolt 2: Shared Project and Projection Model

Implement/test project fixture loading, textual projection and canonical node-to-range mapping.

## Bolt 3: Runtime Evidence and Proposal Boundary

Implement/test step evidence, preview frame data and ProgramProposal inspect/reject/apply behavior.

## Bolt 4: Verification and #121 Handoff

Run build/test/format, record evidence and document what #121 must validate for complete
cross-surface compatibility.

## Execution order

Bolts are sequential. Bolt 1 establishes package boundaries; Bolt 2 and Bolt 3 depend on that
structure; Bolt 4 verifies the complete first slice.
