# Issue 85 Measurement Criteria

## MC-001 Hint Migration

Package tests show an existing deterministic tutor hint can be produced or adapted through the new Learning Companion contract without provider-specific fields.

## MC-002 Builder Boundary

Tests prove builder output is a proposal payload and does not expose accepted canonical program state, direct mutation, patch application or executable hidden action.

## MC-003 Debugger Evidence

Tests prove debugger responses identify evidence references or observed facts separately from suggestions, and reject claims that do not reference supplied evidence when required.

## MC-004 Fail Closed

Tests prove malformed responses, unknown provider fields and unsupported capability payloads throw contract validation errors.

## MC-005 Provider Equality

Conformance helper accepts any provider output shape that matches the domain schema and rejects provider-specific fields. Tests use fake local and remote-style provider names without changing the schema.

## MC-006 No Required PII

Tests build a valid minimal Learning Companion request without child name, email, age, school, address, location or contact fields.

## MC-007 No Provider SDK Dependency

Package manifest inspection and TypeScript imports show `@agorix/tutor-contract` has no provider SDK dependency.

## MC-008 Documentation

README or architecture note explains the migration from tutor-only naming to Learning Companion capability naming and points consumers away from provider coupling.
