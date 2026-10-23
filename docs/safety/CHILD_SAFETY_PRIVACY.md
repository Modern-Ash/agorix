# Child safety and privacy — POC constraints

Companion documents: [WEB_SECURITY_BASELINE.md](WEB_SECURITY_BASELINE.md) turns these constraints
into CI-enforced controls; [AI_OUTPUT_VALIDATION.md](AI_OUTPUT_VALIDATION.md) covers provider-output
validation; [PRIVACY_THREAT_MODEL.md](PRIVACY_THREAT_MODEL.md) covers the outbound data-flow and
data-minimization model for local vs. remote AI modes (issue #103).

## POC data minimization

The proof of concept requires no child account, real name, email, school, address, precise age, photo or public profile.

Use an anonymous/local learner profile if a display name is needed.

## Account and project modes

The shipped POC mode is anonymous/local: projects are saved on the device with
`ProjectProgram` plus minimal `ProjectMetadata`, and no account, session,
recovery contact or project-owner descriptor is required.

A future private authenticated mode may wrap the same canonical project in
provider-neutral account, session and ownership contracts:

- account identity uses an opaque `accountId`, a child-safe alias/username,
  status and creation timestamp;
- session identity uses an opaque session reference, `accountId`, creation time
  and expiry time;
- project ownership uses `projectId`, `ownerAccountId`, title, revision and
  timestamps in an envelope outside `ProjectProgram`;
- email is not mandatory in the domain contract;
- recovery contact is an explicit deployment capability with retention and
  deletion implications, not a default account field.

The alias policy is username-style and case-insensitive after normalization.
Aliases must not be email addresses, must not use reserved system names, and
should not ask a child for a real name.

Identity, sessions and ownership must never be embedded in `ProjectProgram`.
This keeps anonymous/local and authenticated-private projects semantically
compatible across Web, Tablet and Studio.

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

Starter assets are bundled and curated. User-supplied images and audio are not part of the child flow.

**Reviewed exception (owner decision, 2026-10-23, issue #501):** an _adult_ may add local images
(Ori, explorers, backdrops: flag `customImages`) and local audio (flag `customAudio`) from the Adults
panel, only with all of these controls:

- adult-gated; the child cannot open the file picker;
- stays on the device: no upload, no network request, never part of an account sync, never sent to
  Ori or any provider, never in evidence events;
- images are decoded locally, resized to 256 px and re-encoded, which drops EXIF/GPS; file type is
  checked by content, not by name; audio has a size and duration cap;
- exports (`.agorix`) exclude the media unless the adult opts in;
- an adult can remove all of it in one tap, and nothing is recorded about who or what is shown.

Anything beyond that (child-captured media, voice recording, camera, shared or synced media) needs a
new review.

## Security baseline

- dependency scanning;
- CSP and standard web headers where deployed;
- no eval of generated text;
- canonical program interpreter uses an explicit operation allowlist;
- strict project schema validation;
- external links controlled.

## Future work

Before real child accounts, remote project storage or public release, perform
external product/legal/privacy review, jurisdiction-specific consent design,
moderation/threat modeling and retention policies. Those are intentionally
outside the technical POC; this document records minimization assumptions and
does not claim legal compliance.

Authenticated child account designs must document what data is collected, the
purpose for collection, storage location, retention/deletion rules, account
deletion effects, and what is never collected. At minimum, the default product
posture remains: no real name, mandatory email, precise age, school, address,
photo, public profile, advertising identifier or monetization profile.

Note (2026-10-23, issue #471): the rule above is about the **child**. The optional adult account
for linking a child device requires a verified adult email (see
`docs/superpowers/specs/2026-10-23-kids-adult-link-design.md`). That email is the adult's, is never
shown to or stored on the child device, and is never sent to Ori or any provider.
