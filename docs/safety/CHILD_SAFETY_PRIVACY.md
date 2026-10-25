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

Starter assets are bundled and curated. Children cannot delete or replace them.

**Reviewed exception (owner decision, 2026-10-23, issue #501):** an _adult_ may override built-in
images (Ori, explorers, backdrops: flag `customImages`) and add local audio (flag `customAudio`)
from the Adults panel, only with all of these controls:

- built-in image overrides and audio remain adult-gated;
- stays on the device: no upload, no network request, never part of an account sync, never sent to
  Ori or any provider, never in evidence events;
- images are decoded locally, resized to 256 px and re-encoded, which drops EXIF/GPS; file type is
  checked by content, not by name; audio has a size and duration cap;
- exports (`.agorix`) exclude the media unless the adult opts in;
- an adult can remove all of it in one tap, and nothing is recorded about who or what is shown.

**Owner update (2026-10-23, #531):** the adult controls the `customImages` switch in the gated
Adults panel. When enabled, a child may add a local custom explorer or backdrop directly from
Create. The child cannot delete or replace bundled assets, and the add flow offers no delete or
replace control. The local processing, storage, network, export, and adult removal limits above
still apply. Local audio and built-in image overrides remain adult-only.

Anything beyond that (child-captured media, voice recording, camera, shared or synced media) needs a
new review.

## Security baseline

- dependency scanning;
- CSP and standard web headers where deployed;
- no eval of generated text;
- canonical program interpreter uses an explicit operation allowlist;
- strict project schema validation;
- external links controlled.

## Proposed closed group mode (ADR 0010, issue #556)

Group mode is **not active**. It is a closed, same-room exception under review; the prohibitions on
public sharing, discovery and chat remain. An email-verified adult organizer starts and moderates
the session. A child joins without an account, real name, email, school, location or free-text field;
the displayed alias comes from a fixed list. The child can still use the local app without a group.

| Data                                                               | Purpose                                                     | Location and retention target                                                                                                          |
| ------------------------------------------------------------------ | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Organizer account and verified adult email                         | Authenticate and control group creation                     | Existing adult account lifecycle; never shown to a child or sent to Ori.                                                               |
| Group ID, generated aliases, device slots and consent attestations | Admit and moderate up to four children                      | Ephemeral session; delete on close or expiry. F1 must set exact TTLs and backup windows.                                               |
| Program and ordered game inputs                                    | Build and play in the room                                  | Peers only by default; no server project copy. Explicitly exported `.agorix` files remain on the exporting device after group closure. |
| Optional WebRTC offer, answer and ICE candidates                   | Establish a peer connection when QR exchange is impractical | Short-lived server mailbox if enabled; delete after pairing/expiry. These bundles can reveal network addresses.                        |
| Optional TURN traffic                                              | Connect peers on restrictive networks                       | Encrypted game packets transit the relay; the provider can observe IP, timing and volume metadata. No child content log.               |
| Safety decision codes                                              | Explain a rejected share and monitor abuse                  | Counts and coarse reasons only; no image, project text, alias or raw input retained in logs.                                           |

Custom images can be added locally by a child when an adult enables `customImages` (#531). They
must not be transmitted to another group device until a separate local screening and organizer
approval pipeline is implemented. A local classifier is an aid, not a promise of safety; it fails
closed. No child/group identifier or content goes to Ori or a remote provider. The organizer can
remove a peer, mute reactions, close the group and request local deletion; a previously exported
file cannot be remotely erased.

### F1 retention (domain package `@agorix/group-service`, issue #566)

These values are the defaults of `DEFAULT_GROUP_POLICY`; the package is not wired to any endpoint
and the feature stays off.

- **Group lifetime:** 2 hours, then the group, its slots, codes and device keys are deleted. Expired
  groups are also deleted on first access, so an unswept row is never readable.
- **Join proof:** a 6-character code valid for 10 minutes, usable once, at most 3 live codes per
  group. It proves possession, not proximity or permission: the child stays `pending` until the
  organizer approves. Failed guesses are rate limited per source and globally; the source key is an
  HMAC, never a raw address.
- **Stored as hashes:** codes and child device keys are stored only as HMACs. No email, name, school
  or free text of a child exists in any row; aliases and teams come from fixed lists.
- **Consent record:** in a `household` group the organizer must attest the responsible adult's
  consent per child; the timestamp lives with the slot and is deleted with it. A `classroom` group
  needs an opaque institutional authorization reference, not a teacher checkbox alone.
- **Close or expiry:** hard delete, no soft-delete column. Database backup windows are not set by
  this package and remain an open item for the activation review.

Before launch with real children: approve ADR 0010 and the group spec, test on actual tablets and
school networks, and obtain jurisdiction-specific legal/privacy review of the organizer's authority,
adult notice or consent, retention and deletion. The first release must publish an understandable
notice for children and organizers and a way to end participation. This is a design constraint, not
a claim of legal compliance.

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
