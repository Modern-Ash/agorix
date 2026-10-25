# External Ori shadow boundary — integration stage 1

This introduces a **disabled-by-default**, metadata-only hook in Agorix's existing `apps/tutor-api`. It is not a production Ori connection and does not replace the existing `/api/tutor/ori` response.

## Flag and behavior

`AGORIX_ORI_EXTERNAL_SHADOW=true` sets the feature gate in `main.ts`. **No external callback is wired in main yet**, so setting the flag alone has no network or model effect. An authorized server integration may later inject `oriExternalShadow` via `createTutorServer` options.

When enabled _and_ a callback is provided, the existing endpoint asynchronously sends only:

- `missionIndex` (number)
- `hintLevel` (1–5)
- `scriptCount` (number)

No mission ID, child text, program AST, runtime world state, IP, user identity, session or provider credentials are passed. The callback's result is ignored. The current tutor decision and response envelope remain unchanged. Failures must not change the child's experience.

```mermaid
flowchart TD
  A["Kids POST /api/tutor/ori"] --> B["Existing validation, rate limit"]
  B --> C{"Shadow enabled + callback?"}
  C -->|No| D["Existing Ori decision"]
  C -->|Yes| E["Minimal metadata-only callback"]
  E --> F["Discard shadow result"]
  C --> D
  D --> G["Existing response unchanged"]
```

## Remaining work

1. Define an actual trusted transport/adapter between Agorix and `Modern-Ash/ori`, including cancellation and bounded concurrency.
2. Establish host-owned `ProgramProposal` creation, `validateProgramProposal` and `createProposalReview` on synthetic fixtures.
3. Add full server integration tests verifying disabled/enabled behavior and fallback parity.
4. Complete privacy and safeguarding review before sending any child-related context to external models.
5. Keep the existing endpoint response contract and rollback available.

**This stage deliberately cannot apply or propose edits through the external agent.**

## Transport increment

`apps/tutor-api/src/oriExternalShadowTransport.ts` now implements a bounded 750ms loopback HTTP POST to Ori's synthetic `/v0/shadow` endpoint. It is configured only when **both** `AGORIX_ORI_EXTERNAL_SHADOW=true` and `AGORIX_ORI_EXTERNAL_SHADOW_URL=http://127.0.0.1:<port>/v0/shadow` are set. Responses are discarded and failures cannot change the learner-facing tutor decision.

The counterpart synthetic endpoint is developed in `Modern-Ash/ori` PR #46. **No deployment or real child data testing is authorized**. The transport currently has no authentication and must not be exposed beyond a trusted loopback test environment. Future production integration requires identity, CSRF, bounded concurrency, retry policies and safeguarding review.

## Metadata-only plan evaluation (Ori PR #47)

The loopback transport now also accepts `/v1/plan`, an experimental Ori endpoint returning generic pedagogical steps based solely on mission index, hint level and script count. **Agorix intentionally discards that response**; there is no child-facing plan, model call, program edit or change to the existing tutor API envelope.

To test in a trusted local environment only, use `AGORIX_ORI_EXTERNAL_SHADOW_URL=http://127.0.0.1:<port>/v1/plan` with the existing disabled-by-default flag. The reference Ori server must be started separately. Do not enable in production.
