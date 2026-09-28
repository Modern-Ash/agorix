# AI output validation and child-safety boundary

Companion documents: [WEB_SECURITY_BASELINE.md](WEB_SECURITY_BASELINE.md) holds the CI-enforced web
and child-safety controls; [CHILD_SAFETY_PRIVACY.md](CHILD_SAFETY_PRIVACY.md) holds the POC data
minimization rules this boundary protects.

Issue #100 adds a shared validation boundary for Learning Companion provider output before it can reach learner-facing UI, ProgramProposal workflows, or canonical program mutation paths.

## Boundary

Provider output is accepted only after these layers pass:

| Layer                         | Enforcement                                                                                                | Evidence                                                                       |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Transport/parsing             | Provider runtimes parse structured JSON and fail closed as `invalid-response`.                             | `packages/provider-runtime/src/index.test.ts` malformed output tests.          |
| Schema/version                | `validateLearningCompanionResponse` checks schema, capability, payload shape, and provider-neutral fields. | `packages/tutor-contract/src/index.test.ts` malformed/provider-specific tests. |
| Requested capability          | `validateLearningCompanionSafety` requires response capability to match request capability.                | Contract safety tests.                                                         |
| Scaffolding/assistance policy | Low-scaffold responses cannot give exact-copy/full-solution instructions.                                  | Over-assistance fixture.                                                       |
| ProgramProposal safety        | Builder proposals must validate against the current accepted program before review.                        | Stale proposal fixture.                                                        |
| Content/safety policy         | Child-facing text may not ask for name, address, school, contact, location, phone, or email.               | PII-seeking fixture.                                                           |
| Hidden provider actions       | Child-facing text may not expose raw hidden tool/function actions as accepted state.                       | Hidden tool-action fixture.                                                    |
| Context/provenance integrity  | Debugger facts must reference supplied deterministic runtime evidence.                                     | Invented runtime fact fixture.                                                 |

## Child-facing failure

Rejected AI output must not expose raw provider content. The shared safety error carries this safe message:

> I couldn't use that AI suggestion safely. Your program stayed the same.

Developer diagnostics use structured non-PII codes and paths.

## Review checklist

- [ ] Provider output reaches UI only after contract and safety validation.
- [ ] Rejection leaves canonical program unchanged.
- [ ] Local and remote adapters use the same validation path.
- [ ] Tests include malformed schema, PII-seeking content, over-assistance, unsafe ProgramProposal, hidden action, and invented evidence fixtures.
- [ ] Logs/evidence do not include secrets, child PII, raw provider transcripts, or hidden tool payloads.
