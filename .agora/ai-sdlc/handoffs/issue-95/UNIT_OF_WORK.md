# Issue 95 Unit Of Work

## In Scope

- Provider-runtime implementation and tests for one optional commercial remote adapter path.
- Migration documentation mapping legacy #27 behavior into the provider-neutral architecture.
- Common conformance coverage proving commercial and local/fake providers share contract semantics.
- Documentation updates for configuration, fallback, and extension patterns.

## Out Of Scope

- Real production credentials or live commercial-provider calls.
- Browser-side provider secrets.
- Product UI for choosing providers.
- A full provider conformance matrix for every supported provider.
- Rewriting canonical curriculum, ProgramProposal semantics, or editor runtime flows.

## Dependencies

- #85, #92, #93, and #94 establish the provider runtime and provider-neutral remote/local architecture.
- #27 provides legacy server-side security, configuration, timeout, validation, context-minimization, and fallback requirements to preserve or migrate.
