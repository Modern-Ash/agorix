# Agorix Kids: group mode, build and play together in the same room (design draft, no code)

Status: **DRAFT, updated with owner decisions 1 and 2 (2026-10-24)**; items 3 and 4 still open. Tracks issue #556 under epic #555. Decision record: ADR 0010.

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

**WebRTC data channels in a star topology, with the organizer's device as the host (sequencer). Pairing is done in person by QR code or short code, with no signaling server.**

### Options considered

| Option | Verdict |
| --- | --- |
| Cloud WebSocket relay | Rejected for v1. Not local, needs Internet, routes group traffic through the server, adds a realtime surface to an HTTP-only server. Possible later as an explicit fallback. |
| **WebRTC P2P, star, in-person pairing** | **Recommended.** Browser-native (PWA and Capacitor WebView), no new server, traffic stays on the room network, works with no Internet, proximity is enforced by the pairing act itself. |
| Local server on the organizer device | Rejected. A browser cannot listen on a port; would need a native Capacitor plugin on one platform. Heavy, uneven across devices. |
| Bluetooth / Nearby / mDNS discovery | Rejected. Not available across iOS Safari and Android Chrome. |

### Why this fits the current architecture

- The runtime is deterministic and seeded, so devices need only the **same program, same seed and same ordered inputs** to compute the same game. No state sync, which also means less data on the wire.
- The host acts as a **lockstep sequencer**: every tick it collects each player's input, assigns a global order and broadcasts the ordered input frame. Clients run the runtime locally. The host is not trusted for secrets because there are none, but it is authoritative for ordering.
- No server code is required for play. The existing server stays HTTP-only.

### Pairing and signaling (no server)

1. Organizer starts a session; the host device creates a WebRTC offer and shows it as a **QR code** (and a short fallback code).
2. Each child device scans it and shows an answer QR back; the host scans it. Done once per child, in the room. Proximity is physical.
3. Session code and offer expire in minutes; reconnect repeats the scan. Join is rejected once the roster is full or locked by the organizer.
4. Direct local connection is tried first (host candidates). If it fails (for example Wi-Fi client isolation), the **minimal free-cost relay** below is used.

### Minimal relay (decided: yes, free of cost, minimal)

Goal: keep the same-room design but rescue the cases where devices cannot reach each other directly, using only free tiers.

- **Signaling mailbox** on the existing `apps/server`: tiny HTTP endpoints (POST/GET with short polling or SSE; no WebSocket), keyed by the session token of the signed-in organizer, holding only the offer/answer text for a few minutes, then deleted. Replaces QR scanning when the QR is impractical. No extra infrastructure, no new cost.
- **STUN**: a free public STUN service. Carries no game data.
- **TURN (only if direct fails)**: a provider with a free allowance (candidate: Cloudflare Realtime TURN; alternatives: other free tiers or self-hosted coturn). Availability and limits to be verified before F3. TURN relays only DTLS-encrypted packets, so the relay cannot read inputs.
- Limits: tiny session size (max 5 devices), session lifetime cap (for example 2 hours), per-organizer rate limit, so free tiers cannot be exhausted by abuse.
- Still no game or project content is stored on any server. A separate privacy review is required before enabling the relay (see ADR 0010).

### Known risks and mitigations

- **Client isolation (AP isolation) on school or guest Wi-Fi** blocks device-to-device traffic. Mitigation: the minimal relay above, or the organizer's phone hotspot; the app detects a failed connection and says why.
- **QR/short-code pairing friction** for young children. Mitigation: the organizer, not the child, scans; large-target UI; tested in the playtest (#389).
- **mDNS-obfuscated ICE candidates** on some browsers. To be validated in a throwaway spike on real tablets before F3.
- **Lockstep latency**: input delay equal to the slowest device. Acceptable for cooperative and turn-based games on a LAN; first release restricts to those.
- **Determinism across devices**: confirm identical runs on tablet and web for a shared seed and input log (acceptance test in F3, listed in #556).

## Organizer role (proposed)

- **Not a new account type for children.** The organizer is an existing adult account (verified email, as in #504) with an `organizer` capability.
- Capability gives: create/close groups, name teams, lock the roster, remove a child, view the group summary. It does not grant access to a child's data beyond the aggregates already shown in the adults panel.
- Same role covers a teacher and a parent with friends. For a non-class group, the organizer confirms that each child's adult has consented (checkbox plus short notice; not legal advice; legal review required before launch).
- **Decided (owner, 2026-10-24): the organizer account is mandatory.** No group can be started without a signed-in, email-verified organizer. Consequence: starting a session needs Internet once (sign-in and a short-lived session token); after that, play can continue on the local network. Offline-only start is out of scope.

## Group and team model

- **Group**: created by the organizer; ephemeral; closing deletes everything related to it. Children appear as a generated alias (e.g. "Blue Fox") picked from a fixed list; no text input.
- **Team**: 2 to 4 children inside a group; roles (characters, scene, rules, testing) assigned by the team or organizer.
- **Persistence**: the team project is a normal `.agorix` project saved on the host device (and optionally each member's device). No server copy.

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

**What exists today (verified):** `apps/web/src/kids/kidsImage.ts` is a *local deterministic sanitizer*, not AI: content-type check by bytes, size and pixel caps, decode, resize to 256 px and re-encode (drops EXIF/GPS). It never touches the network. It does not judge what the image shows.

**Proposal: pipeline for any content that crosses to other devices in the group**

1. Deterministic sanitizer (exists for images; add the equivalent for text such as project, team and character names, length-capped and character-set limited).
2. **Local AI pre-filter** (new): an on-device classifier for images (unsafe/violent/sexual/hateful symbols) and for text (insults, personal data such as names, phone numbers, addresses). Runs in the browser or Capacitor WebView; **nothing is sent to any provider**, consistent with `kidsImage.ts` and `CHILD_SAFETY_PRIVACY.md`.
3. **Fail closed:** if the model is unavailable, uncertain or errors, the content is not shared.
4. **Organizer approval queue:** anything shared to the group (custom art, names) is held for the organizer by default; the AI verdict is shown as a hint, never as the final decision. Local-only content stays on the child's device and is not blocked by this.
5. Rejection message to the child is neutral and does not echo the content. No log keeps the content; only a count and a coarse reason code.

**Notes and limits**
- A remote moderation model (cloud) would send children's content to a provider. That is not allowed here; it would need its own ADR, privacy review and an organizer opt-in.
- Classifiers make mistakes both ways. That is why the AI is a pre-filter and the adult approves, and why the first release keeps shared content to a minimum: custom images are already adult-gated (flag `customImages`), and names come from a list or a short sanitized field.
- Every threshold, model choice and list above is admin-configurable and stored in the database (see "AI configuration").
- Open technical item for F0: choose the local models (size, license, accuracy on tablets) and measure false positives with children's drawings; start with a throwaway benchmark.
- Free-text chat remains out of scope. If it were ever wanted: new ADR, default-deny, local model, organizer queue.

## AI configuration: admin-editable and persisted (owner rule, 2026-10-24)

Everything this feature parametrizes with AI must be **editable by an administrator and persisted in the database**, through the registry in issue #545 (versioned per capability, revision history, author, date, rollback, explicit publish, admin auth separate from adult accounts). Nothing lives in code constants, process memory or `localStorage`.

New AI capabilities introduced here, to register in #545:

| Capability | Editable by admin (persisted, versioned) |
| --- | --- |
| `group.moderation.image` | local model id/version, enabled flag, thresholds, categories blocked, fail-closed policy |
| `group.moderation.text` | local model id/version or rule set, enabled flag, thresholds, PII patterns, blocked-term lists per locale |
| `group.approval-queue` | default (always hold for organizer vs. auto-allow when score is low), retention of reason codes |
| `group.reactions` | the fixed emoji set per locale |
| `group.limits` | max group size (default 5), max session duration, per-organizer rate limits, relay enabled flag |

Secrets (for example TURN credentials) stay in server secrets, not in the editable configuration. An invalid version never affects production, and with no valid configuration the safe default is fail closed (nothing shared, relay off). Models themselves are chosen from an allow-list the admin manages; they run on-device.

## Safety and privacy

- No data leaves the room by default: no server round trip for group play.
- No chat, no phrases, no free text; no images, names or locations.
- Organizer can remove a child, lock the roster, end the session.
- `docs/safety/CHILD_SAFETY_PRIVACY.md` gets a group-mode section (data, purpose, retention, deletion) and "Prohibited" stays unchanged except the explicit ADR 0010 exception.
- AI pre-filter and approval queue for content shared in the group (see Moderation).
- Threat model to complete in F0: impersonation of an alias, leaked session code, shared-device mix-ups, a malicious child device sending crafted inputs (host validates every input against the program's declared input schema and rate limits it), emoji used to tease.

## Phases (from #555)

F0 design (this draft) -> F1 organizer role and groups -> F2 team project -> F3 same-room multiplayer (starts with a throwaway WebRTC spike on real tablets) -> F4 group gallery and organizer view.

## Open items for the owner

1. ~~Account-free vs mandatory sign-in~~ Decided: mandatory.
2. ~~Cloud relay~~ Decided: yes, minimal and free-cost.
3. ~~Allowed phrases~~ Dropped: no chat and no phrases (only optional emoji reactions).
4. **Legal review.** Before real children use it, a lawyer or privacy specialist should confirm that an organizer who is not the child's parent (a teacher, or a parent with other children) may legally act for them, under laws such as COPPA (US) and GDPR (EU). This design is not legal advice. **Parked by the owner (2026-10-24): not decided yet.** Recommended: before F1 goes to production, not before building.
