# Child safety and privacy — POC constraints

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
- UI must make clear that tutor suggestions can be wrong.

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
