# Child safety and privacy — POC constraints

Companion documents: [WEB_SECURITY_BASELINE.md](WEB_SECURITY_BASELINE.md) turns these constraints
into CI-enforced controls; [AI_OUTPUT_VALIDATION.md](AI_OUTPUT_VALIDATION.md) covers provider-output
validation; [PRIVACY_THREAT_MODEL.md](PRIVACY_THREAT_MODEL.md) covers the outbound data-flow and
data-minimization model for local vs. remote AI modes (issue #103).

## POC data minimization

The proof of concept requires no child account, real name, email, school, address, precise age, photo or public profile.

Use an anonymous/local learner profile if a display name is needed.

## Prohibited POC features

- public chat;
- direct messaging;
- public project publishing;
- friend/follower graph;
- location collection;
- advertising;
- behavioral profiling for monetization.

## AI tutor

- browser must not contain provider secrets;
- minimum context only;
- raw conversation persistence disabled by default;
- provider request/response logs must be disabled or redacted where controllable;
- UI must make clear that tutor suggestions can be wrong;
- local mode (fake/Ollama runtime) makes no external-network request — `localhost` only; remote mode is opt-in and routes through the server-side `apps/tutor-api`, never directly from the browser (see [PRIVACY_THREAT_MODEL.md](PRIVACY_THREAT_MODEL.md)).

## Content

Starter assets are bundled and curated. No user-uploaded images/audio in POC unless separately reviewed.

## Security baseline

- dependency scanning;
- CSP and standard web headers where deployed;
- no eval of generated text;
- canonical program interpreter uses an explicit operation allowlist;
- strict project schema validation;
- external links controlled.

## Future work

Before real child accounts or public release, perform jurisdiction-specific privacy/legal review, parental consent design, moderation/threat modeling and retention policies. Those are intentionally outside the technical POC.
