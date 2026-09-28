# Issue 92 Suggested Bolts

## Bolt 1: Runtime Contract

Define provider runtime identity, model/config identity, capability descriptors, locality, structured output support, context limits and request/response transport.

## Bolt 2: Negotiation And Errors

Define capability negotiation result plus normalized timeout, cancellation, unsupported capability, invalid response, configuration and provider failure errors.

## Bolt 3: Fake Adapters

Implement deterministic local fake and remote-style fake adapters with different supported Learning Companion capabilities.

## Bolt 4: Conformance Harness

Add tests proving fake adapters pass the same interface, mismatch is explicit and timeout/cancel behavior normalizes.

## Bolt 5: Configuration

Add helper/model for selecting provider and model through configuration, without domain-schema changes.

## Bolt 6: Documentation

Update architecture docs with dependency direction, provider isolation and how #93/#94/#95 should extend the interface.
