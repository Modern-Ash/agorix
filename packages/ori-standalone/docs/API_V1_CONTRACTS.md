# Ori API v1 — contract specification (issue #7)

This specification describes a host-neutral API. It does not activate child-facing endpoints, execute tools, or authorize changes. Existing `ori/session/v0` and `ori/proposal/v0` contracts remain supported.

## Common rules
- Each envelope contains `schemaVersion` and rejects unknown fields.
- Every tool request is checked against host-issued grants; model text never grants permissions.
- Host-provided execution evidence is authoritative; Ori must never fabricate it.
- All proposals require explicit learner approval and host-side validation before applying.
- The Kids profile prohibits arbitrary shell, git, filesystem, and network tools.
- No raw child messages, identity, or personal data are persisted by Ori.

## Versioned envelopes
| Kind | Version | Required fields |
| --- | --- | --- |
| Context | `ori/context/v1` | `schemaVersion`, `sessionId`, `learningStage`, `capabilities`, `grants` |
| Plan | `ori/plan/v1` | `schemaVersion`, `steps` |
| Tool call | `ori/tool-call/v1` | `schemaVersion`, `name`, `grantId` |
| Proposal | `ori/proposal/v1` | `schemaVersion`, `operations`, `requiresLearnerApproval: true` |
| Trace evidence | `ori/trace-evidence/v1` | `schemaVersion`, `source: host-runtime`, `steps` |
| Refusal | `ori/refusal/v1` | `schemaVersion`, `reason` |
| Error | `ori/error/v1` | `schemaVersion`, `code`, `retryable` |

## Implementation and acceptance
1. Add JSON Schema 2020-12 definitions with bounds and `additionalProperties: false`.
2. Add runtime validators and positive/negative tests (malformed data, excess size, unknown fields, forged grants, unauthorized tool calls, proposal without approval).
3. Maintain separate v0 compatibility; do not silently reinterpret old proposals.
4. Add an independent synthetic host example and confirm roundtrip with no auto-apply.
5. Verify `npm test` and `npm run check` in CI, then human review.

## Ownership
Ori owns orchestration, provider selection and pedagogical planning. Each host owns project storage, canonical execution, grants, approval and authoritative trace evidence. Agorix is the first host, not the only host.

## Branch policy
Any Agorix work targets **only** `integration/ori`; never Agorix `main` or `develop`.
