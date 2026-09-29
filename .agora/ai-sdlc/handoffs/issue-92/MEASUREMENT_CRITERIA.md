# Issue 92 Measurement Criteria

## MC-001 Vendor SDK Absence

TypeScript package manifests and imports show no vendor SDK dependency in provider-neutral contract/domain packages.

## MC-002 Fake Adapter Conformance

Tests run at least two fake adapters with different capability sets through the same conformance harness.

## MC-003 Explicit Capability Mismatch

Tests prove unsupported Learning Companion capability requests return a structured mismatch/unsupported-capability result instead of implicit fallback or provider-specific error.

## MC-004 Timeout And Cancellation

Tests prove timeout and cancellation are normalized into shared error codes.

## MC-005 Local/Remote Shared Interface

Tests prove local fake and remote-style fake adapters use the same request/response interface while reporting different locality/capability metadata.

## MC-006 Configurable Provider/Model

Tests or config helpers prove provider id and model id can change through configuration without changing domain payload schemas.

## MC-007 Architecture Documentation

Architecture docs describe dependency direction and secret/provider-metadata isolation.
