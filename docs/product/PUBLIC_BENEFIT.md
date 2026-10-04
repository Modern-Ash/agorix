# Public benefit commitment

Agorix is shared free with foundations and educational institutions. This document says what that means and what it requires of the product. It derives from [`../FOUNDATIONS.md`](../FOUNDATIONS.md).

## Commitment

1. **Free software.** Source code and repository documentation stay under Apache-2.0 (ADR 0002). Anyone can self-host.
2. **Free hosted service for institutions.** Modern Ash intends to operate a hosted Agorix at no charge to verified educational institutions and foundations, funded by donations or grants.
3. **Remote AI off by default.** The hosted service must not depend on paid remote model calls. Remote AI is an explicit, opt-in tier.
4. **No tiers that gate learning.** There is no paid tier that unlocks pedagogy. Core learning is never behind a paywall.

The hosted service is a commitment of intent, bounded by funding. It does not change the license and is not a service-level agreement.

## What this requires of the product

| Requirement                   | Consequence                                                                                                                                   |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Near-zero AI cost             | Deterministic (System 0) and local tiers first; LAYA decides whether a model is needed; per-session budget degrades to deterministic answers. |
| Offline and local-first       | Projects, runtime, missions and deterministic help work without a network.                                                                    |
| No mandatory account          | A learner or class can start with no sign-up. Accounts are optional sync.                                                                     |
| Modest devices                | Core surfaces run on low-end hardware; no feature requires a GPU or a large local model.                                                      |
| Languages and accessibility   | i18n and keyboard/screen-reader paths are release conditions, not extras.                                                                     |
| Educator evidence without PII | Exportable, aggregate or pseudonymous evidence for teachers; never names, emails, free text or raw model output.                              |
| Self-hostable                 | An institution can run Agorix on its own infrastructure with no provider credentials.                                                         |

## Educator tooling boundary

Educator tools (evidence export, class-level deployment, content selection) are allowed. Classroom surveillance, ranking children, and any engagement-maximizing mechanic are not. `PRODUCT_INTENT.md` records "classroom administration" as a POC non-goal; ADR 0007 narrows that non-goal to administration and surveillance, not to educator evidence.

## Open decisions

- Verification process for institutions and foundations.
- Who funds hosting and the opt-in remote AI tier, and under what terms.
