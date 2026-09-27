# Issue 85 Suggested Bolts

## Bolt 1: Contract Envelope

- Add schema constants and types for Learning Companion request/response.
- Add capability identity for coach, builder, debugger, explainer, challenger and reflector.
- Add shared context model with minimum required inputs.

## Bolt 2: Validation And Conformance

- Add validators and parse helpers.
- Reject unknown provider-specific fields.
- Add reusable provider contract assertion for Learning Companion providers.

## Bolt 3: Capability Payloads

- Add structured payload validation for each required capability.
- Ensure builder proposals cannot be confused with accepted program state.
- Ensure debugger separates runtime facts from suggestions.

## Bolt 4: Migration Compatibility

- Preserve existing tutor hint behavior.
- Provide adapter/helper from legacy tutor request/response to coach/hint Learning Companion semantics.
- Keep existing web and tutor-api consumers building.

## Bolt 5: Deterministic Fake

- Implement deterministic fake responses for all required capabilities or document staged subset explicitly.
- Keep fake provider free of provider SDKs and network access.

## Bolt 6: Docs And Evidence

- Update package README.
- Add architecture/migration note.
- Run targeted tests and repository verification suitable for a contract package.
