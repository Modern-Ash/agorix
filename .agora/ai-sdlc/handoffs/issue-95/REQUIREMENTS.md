# Issue 95 Requirements

## Functional Requirements

- Inspect and explicitly map the legacy #27 real-LLM tutor implementation as preserved, superseded, or migrated.
- Provide one optional commercial remote provider adapter path behind the common Learning Companion provider-runtime contract.
- Keep provider, model, endpoint/base URL, timeout, and authentication configurable through server-side configuration.
- Ensure no commercial provider is required for build, test, or the core learning flow.
- Keep provider branding out of domain types and child-facing defaults.
- Validate all remote provider outputs through the same structured ProgramProposal and runtime validation rules as local/fake providers.
- Ensure no direct remote provider response can mutate the canonical program.
- Degrade to another configured provider, fake provider, or offline experience when policy allows.
- Document how additional commercial adapters should fit the same contract.

## Acceptance Criteria

- #27 scope is mapped as preserved, superseded, or migrated.
- One optional remote adapter passes common conformance tests without requiring real credentials.
- No secret reaches browser code, source control, logs, or committed fixtures.
- Switching remote/local providers does not change curriculum/runtime semantics.
- README and provider docs do not imply a preferred proprietary vendor.
- Migration note and conformance results are captured as evidence.
