# Agorix Kids: group mode, build and play together in the same room (design draft, no code)

Status: **DRAFT for product-owner approval (2026-10-24)**. The organizer account and limited relay were decided; legal review remains a launch gate. Tracks issue #556 under epic #555. Decision record: ADR 0010.

## Why

Kids in the same room (a class, or an adult with their children and friends) should build one project as a team and play games against or with each other, taking the best of Roblox's collective idea without its risks (open chat, public catalogue, strangers, identity, economy).

## Product owner decisions (2026-10-24)

1. One adult **organizer** (a teacher, or a parent/adult with their children and friends) creates and moderates the group.
2. Games are played **in the same room**, seeking **local proximity**.
3. The organizer is a **new platform role**; it does not exist today.

## What exists (verified 2026-10-24)

- Runtime (`packages/runtime`) has no `Math.random`, `Date.now` or `new Date`; randomness is seeded (`normalizeRandomSeed`, `execute.ts`); multi-actor support with isolation tests (`multiActor.ts`).
- Server (`apps/server`) is a plain `node:http` server behind nginx. No WebSocket or realtime channel.
- `auth-service` and `link-service` have no role concept: only an adult account with verified email.
- Web is a PWA; Capacitor packaging for Android/iOS is planned (`docs/architecture/SYSTEM_DESIGN.md`).
- ADR 0009: no public sharing, discovery, comments, likes or remix in Kids; revisit "only with a classroom mode and a moderation plan".

## Goals

- A group of 2 to 4 children builds one project as a team and plays it together in the same room.
- No child account, email, name, location or free text. Nothing identifiable reaches Ori or any provider.
- Works on the room's network or an organizer's phone hotspot, with no Internet where possible.
- The organizer sees, moderates and closes the group; closing leaves no child data anywhere.

## Non-goals

- Remote play (different places), public galleries, discovery, chat, friends graph, matchmaking with strangers.
- Competitive ranking, economy, avatars with identity.

## Transport: recommendation

**WebRTC data channels in a star topology, with the organizer's device as the host (sequencer). The default pairing path exchanges complete offer, answer and ICE candidate bundles through in-person QR scans; a short code works only with the optional online signaling mailbox.** A QR alone does not establish a connection until both sides have exchanged these bundles. The throwaway F3 spike must prove that the bundle fits a usable number of QR frames on the target tablets.

### Options considered

| Option                                  | Verdict                                                                                                                                                                                 |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cloud WebSocket relay                   | Rejected for v1. Not local, needs Internet, routes group traffic through the server, adds a realtime surface to an HTTP-only server. Possible later as an explicit fallback.            |
| **WebRTC P2P, star, in-person pairing** | **Recommended.** Browser-native (PWA and Capacitor WebView), no new server, traffic stays on the room network, works with no Internet, proximity is enforced by the pairing act itself. |
| Local server on the organizer device    | Rejected. A browser cannot listen on a port; would need a native Capacitor plugin on one platform. Heavy, uneven across devices.                                                        |
| Bluetooth / Nearby / mDNS discovery     | Rejected. Not available across iOS Safari and Android Chrome.                                                                                                                           |

### Why this fits the current architecture

The [WebRTC signaling guide](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Signaling_and_video_calling) confirms that offers, answers and ICE candidates need an application-defined exchange; the [WebRTC security RFC](https://datatracker.ietf.org/doc/html/rfc8826) documents the network-address privacy implications. The transport recommendation is a design hypothesis pending the tablet spike, not a verified cross-device result.

- The runtime is deterministic and seeded, so devices need only the **same program, same seed and same ordered inputs** to compute the same game. No state sync, which also means less data on the wire.
- The host acts as a **lockstep sequencer**: every tick it collects each player's input, assigns a global order and broadcasts the ordered input frame. Clients run the runtime locally. The host is not trusted for secrets because there are none, but it is authoritative for ordering.
- No server code is required for play. The existing server stays HTTP-only.

### Pairing and signaling (no server)

1. Organizer starts a session; the host device waits for ICE gathering to finish, then shows an offer plus candidates as one or more **QR frames**. Offline pairing carries no STUN or TURN candidates.
2. Each child device scans the offer, gathers its own local candidates and shows answer QR frames; the host scans them. Done once per child, in the room. A short code is only a lookup key for the online mailbox and is never sufficient offline.
3. Session code and offer expire in minutes; reconnect repeats the scan. Join is rejected once the roster is full or locked by the organizer.
4. Direct local connection is tried first (host candidates). If it fails (for example Wi-Fi client isolation), the online relay can be offered only when enabled and Internet is available. There is no promise of connectivity on an isolated school network while offline.

QR scanning uses the camera API, which requires a secure context and user permission. The current Web `Permissions-Policy` explicitly has `camera=()`, so F3 must change that policy only for the group scan surface and verify it in the production headers. A text copy/paste of the full signaling bundle may serve as a supervised fallback on devices without camera permission. WebRTC peers can learn each other's network addresses through ICE; in-person pairing limits the audience but does not eliminate this metadata.

### Minimal relay (decided: yes, free of cost, minimal)

Goal: keep the same-room design but rescue the cases where devices cannot reach each other directly, using only free tiers.

- **Signaling mailbox** on the existing `apps/server`: tiny HTTP endpoints (POST/GET with short polling or SSE; no WebSocket), keyed by the session token of the signed-in organizer, holding only the offer/answer text for a few minutes, then deleted. Replaces QR scanning when the QR is impractical. No extra infrastructure, no new cost.
- **STUN**: a free public STUN service. Carries no game data.
- **TURN (only if direct fails)**: Cloudflare Realtime TURN is a candidate with a [shared monthly free allowance and usage-based charges beyond it](https://developers.cloudflare.com/realtime/turn/faq/). It is not a guaranteed zero-cost service. F3 must verify current terms, set a hard operational budget and ensure the relay stays off when credentials or budget controls are absent. TURN relays DTLS-encrypted packets, so it cannot read game inputs, but it sees connection metadata.
- Limits: tiny session size (max 5 devices), session lifetime cap (for example 2 hours), per-organizer rate limit, so free tiers cannot be exhausted by abuse.
- Still no game or project content is stored on any server. A separate privacy review is required before enabling the relay (see ADR 0010).

### Known risks and mitigations

- **Client isolation (AP isolation) on school or guest Wi-Fi** blocks device-to-device traffic. Mitigation: the minimal relay above, or the organizer's phone hotspot; the app detects a failed connection and says why.
- **QR/short-code pairing friction** for young children. Mitigation: the organizer, not the child, scans; large-target UI; tested in the playtest (#389).
- **mDNS-obfuscated ICE candidates** on some browsers. To be validated in a throwaway spike on real tablets before F3.
- **Lockstep latency**: input delay equal to the slowest device. Acceptable for cooperative and turn-based games on a LAN; first release restricts to those.
- **Determinism across devices**: confirm identical runs on tablet and web for a shared seed and input log (acceptance test in F3, listed in #556).
- **Execution model**: the current runtime replays a finite ordered event list; it does not expose an incremental lockstep tick protocol. F3 must define canonical event serialization, frame numbers, input deadlines, missing-player action, version pinning, state digests and resync/rejoin behavior. Re-running from the start for each input is only a spike strategy, not an assumed production design.

## Organizer role (proposed)

- **Not a new account type for children.** The organizer is an existing adult account (verified email, as in #504) with an `organizer` capability.
- Capability gives: create/close groups, name teams, lock the roster, remove a child, view the group summary. It does not grant access to a child's data beyond the aggregates already shown in the adults panel.
- Same role covers a teacher and a parent with friends, but the authority to include other children is distinct from owning an adult account. A family/friends organizer records an explicit adult-consent attestation for each participating child before joining; the app does not collect that adult's name or email from a child. A school deployment requires a school-level authorization path and notice, not a teacher checkbox alone. Neither path is enabled for real children until the legal/privacy review approves the jurisdiction-specific flow.
- **Decided (owner, 2026-10-24): the organizer account is mandatory.** No group can be started without a signed-in, email-verified organizer. Consequence: starting a session needs Internet once (sign-in and a short-lived session token); after that, play can continue on the local network. Offline-only start is out of scope.

## Group and team model

- **Group**: created by the organizer; ephemeral; closing deletes everything related to it. Children appear as a generated alias (e.g. "Blue Fox") picked from a fixed list; no text input.
- **Team**: 2 to 4 children inside a group; roles (characters, scene, rules, testing) assigned by the team or organizer.
- **Persistence**: the team project is a normal `.agorix` project saved on the host device only until the organizer explicitly exports it. Closing deletes ephemeral group/session state but cannot delete a file already exported or a copy on a peer; the UI must explain this boundary. No server copy.

## Building together

- v1 is **turn- or block-assigned**, not simultaneous editing: each role edits its own part; a change is proposed to the team and applied in order by the host.
- Every change is visible and attributed to an alias (consistent with "nothing happens under the rug").
- Ori proposes to the team; the team decides. Ori never receives aliases, roster or group identity.
- **Communication: none inside the app (owner, 2026-10-24: no chat, as in ADR 0009).** Children are in the same room and talk out loud. The only in-app signal is an optional fixed set of **emoji reactions** pinned to a block or to the game (no words, no text).

## Playing together

- Games are `.agorix` projects with a "players: 2 to 4" mode. Cooperative or turn-based first; competitive later.
- Sync by ordered inputs over the data channels; shared seed from the host.
- Lobby shows aliases only. Host can end the game at any time.

## Moderation and AI pre-filter (owner idea, 2026-10-24)

There is no chat, so there is no live conversation to censor. AI is used as a **pre-filter on content that humans create and that would be shown to the rest of the group**, before anyone else sees it.

**What exists today (verified):** `apps/web/src/kids/kidsImage.ts` is a _local deterministic sanitizer_, not AI: content-type check by bytes, size and pixel caps, decode, resize to 256 px and re-encode (drops EXIF/GPS). It never touches the network. It does not judge what the image shows.

**Proposal: pipeline for any content that crosses to other devices in the group**

1. Deterministic sanitizer (exists for images; add the equivalent for text such as project, team and character names, length-capped and character-set limited).
2. **Local AI pre-filter** (new): an on-device classifier for images (unsafe/violent/sexual/hateful symbols) and for text (insults, personal data such as names, phone numbers, addresses). Runs in the browser or Capacitor WebView; **nothing is sent to any provider**, consistent with `kidsImage.ts` and `CHILD_SAFETY_PRIVACY.md`.
3. **Fail closed:** if the model is unavailable, uncertain or errors, the content is not shared.
4. **Organizer approval queue:** anything shared to the group (custom art, names) is held for the organizer by default; the AI verdict is shown as a hint, never as the final decision. Local-only content stays on the child's device and is not blocked by this.
5. Rejection message to the child is neutral and does not echo the content. No log keeps the content; only a count and a coarse reason code.

**Notes and limits**

- A remote moderation model (cloud) would send children's content to a provider. That is not allowed here; it would need its own ADR, privacy review and an organizer opt-in.
- Classifiers make mistakes both ways. That is why the AI is a pre-filter and the adult approves. The adult controls `customImages`, but a child can add local images when that flag is on (#531); local images must never cross to another device until this group-specific pipeline is implemented and approved. Names remain generated from a fixed list; the first release has no editable name field.
- Every threshold, model choice and list above is admin-configurable and stored in the database (see "AI configuration").
- Open technical item for F0: choose the local models (size, license, accuracy on tablets) and measure false positives with children's drawings; start with a throwaway benchmark.
- Free-text chat remains out of scope. If it were ever wanted: new ADR, default-deny, local model, organizer queue.

## AI configuration: admin-editable and persisted (owner rule, 2026-10-24)

Everything this feature parametrizes with AI must be **editable by an administrator and persisted in the database**, through the registry in issue #545 (versioned per capability, revision history, author, date, rollback, explicit publish, admin auth separate from adult accounts). Nothing lives in code constants, process memory or `localStorage`.

New AI capabilities introduced here require a **versioned schema migration** of the fixed registry delivered in #545, before any group feature is enabled:

| Capability               | Editable by admin (persisted, versioned)                                                                  |
| ------------------------ | --------------------------------------------------------------------------------------------------------- |
| `group.moderation.image` | local model id/version, enabled flag, thresholds, categories blocked, fail-closed policy                  |
| `group.moderation.text`  | local model id/version or rule set, enabled flag, thresholds, PII patterns, blocked-term lists per locale |
| `group.approval-queue`   | default (always hold for organizer vs. auto-allow when score is low), retention of reason codes           |
| `group.reactions`        | the fixed emoji set per locale                                                                            |
| `group.limits`           | max group size (default 5), max session duration, per-organizer rate limits, relay enabled flag           |

**Status (issue #567):** the registry is now `agorix/ai-config/v2` with a `group` section holding the
image and text moderation parameters, the approval-queue default, the reaction sets per locale and the
limits (children per group, session minutes, join-code lifetime, relay flag). Stored v1 revisions are
read as v2 with safe defaults and are not rewritten; a v1 document published by an older admin client
keeps the current group settings instead of resetting them. `onUnavailable` is fixed to `block` and has
no control in the console: a weaker policy needs its own ADR. The console has a "Modo grupo" section.
**Wired:** the tutor service serves the group section read-only at `GET /api/tutor/group-config`; the
project server follows the three limits (`AGORIX_GROUP_CONFIG_URL`, clamped to the hard caps) and the
organizer's device follows the moderation, hold-all and reaction settings, falling back to the
strictest defaults. **Still open:** the on-device classifier itself (its score feeds the admin
thresholds; with none, nothing is shared) and the relay flag, which has no consumer until the optional
signalling mailbox exists.

Secrets (for example TURN credentials) stay in server secrets, not in the editable configuration. An invalid version never affects production, and with no valid configuration the safe default is fail closed (nothing shared, relay off). Models themselves are chosen from an allow-list the admin manages; they run on-device.

## Safety and privacy

- Game inputs stay between peers by default. Organizer sign-in, optional signaling and TURN use the Internet and expose limited connection metadata; they must be described separately in the privacy notice.
- No chat, no phrases, no free text; no images, names or locations.
- Organizer can remove a child, lock the roster, end the session.
- `docs/safety/CHILD_SAFETY_PRIVACY.md` gets a group-mode section (data, purpose, retention, deletion) and "Prohibited" stays unchanged except the explicit ADR 0010 exception.
- AI pre-filter and approval queue for content shared in the group (see Moderation).
- Threats, controls and deletion boundaries are recorded below and in `docs/safety/CHILD_SAFETY_PRIVACY.md`.

### Threat model and controls

| Threat                                  | Required control                                                                                                                                |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Leaked code or QR, remote join          | Short expiry, one-use join proof, organizer approval, locked roster, 4-child cap; a code proves possession, not physical proximity.             |
| Alias impersonation or stolen device    | Ephemeral per-device key bound to one slot; reconnect invalidates the old key; organizer sees a reconnect warning and can remove the slot.      |
| Shared tablet exposes previous group    | Group session memory cleared on close/logout; no silent auto-join; explicit local project export only.                                          |
| Malformed input or denial of service    | Host validates version, actor, input schema, sequence and rate; bounds frame and project size; disconnects repeated offenders.                  |
| Bullying with reactions or shared art   | Tiny fixed reaction set with per-peer rate limit and mute; every shared asset held for organizer review, with remove/end controls.              |
| Personal data in images or project text | Local sanitizer plus on-device pre-filter; fail closed; organizer review; no provider upload or content log.                                    |
| Host loss or dishonest host             | All peers stop safely; no automatic host migration in v1; frame hashes detect divergence, and reconnect needs organizer approval.               |
| Network metadata exposure               | Direct peers see ICE addresses; TURN/signaling see IP and timing. No IP in group history; short retention and explicit notice before relay use. |

### Privacy and legal review note

The organizer's verified adult email is used for authentication and abuse control. Group IDs, device slots, aliases, consent attestations, signaling bundles and coarse safety counts serve only the temporary session. The design target is deletion on close or expiry and no content retained in server logs. Local exported `.agorix` files are outside that automatic deletion boundary. Precise TTLs and backup deletion windows are F1 acceptance criteria.

For US deployments, the [FTC's COPPA guidance](https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions) limits school authorization to educational use and recommends authorization by a school or district rather than an individual teacher. For EU deployments, [EDPB guidance](https://www.edpb.europa.eu/topics/key-gdpr-concepts/children_en) calls for extra protection and age-appropriate transparency for children's data; national rules affect the age of digital consent. A lawyer/privacy specialist must decide controller roles, lawful basis, notices, consent and deletion duties for each deployment before real children use group mode. This note is a design input, not legal advice.

## Phases (from #555)

F0 design (this draft) -> F1 organizer role and groups -> F2 team project -> F3 same-room multiplayer (starts with a throwaway WebRTC spike on real tablets) -> F4 group gallery and organizer view.

## Open items for the owner

1. ~~Account-free vs mandatory sign-in~~ Decided: mandatory.
2. ~~Cloud relay~~ Decided: yes, minimal and free-cost.
3. ~~Allowed phrases~~ Dropped: no chat and no phrases (only optional emoji reactions).
4. **Legal review.** Before real children use it, a lawyer or privacy specialist should confirm that an organizer who is not the child's parent (a teacher, or a parent with other children) may legally act for them, under laws such as COPPA (US) and GDPR (EU). This design is not legal advice. **Parked by the owner (2026-10-24): not decided yet.** Recommended: before F1 goes to production, not before building.
