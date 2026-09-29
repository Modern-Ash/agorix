# Issue 95 Non-Functional Requirements

- Security: secrets remain server-side and are never committed, bundled, logged, or exposed to browser code.
- Reliability: remote provider timeout, cancellation, validation failure, and outage cases degrade according to configured fallback policy.
- Portability: provider identity remains adapter/configuration metadata, not part of core domain semantics.
- Testability: conformance coverage runs deterministically with mocked fetch and no live credentials.
- Documentation: docs stay provider-neutral and do not market or prefer any proprietary vendor.
