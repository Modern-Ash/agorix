# ADR 0010: Kids group mode, same-room collaboration and play

## Status

**Proposed** on 2026-10-24 (owner decisions 1 and 2 recorded the same day) (issue #556, epic #555). Becomes Accepted only after product owner approval, a privacy review and a legal review note. Narrows, does not remove, ADR 0009.

## Context

- ADR 0009 forbids public sharing, discovery, comments, likes and remixing in Kids, and says to revisit "only with a classroom mode and a moderation plan".
- The product owner wants children in the same room (a class, or an adult with their children and friends) to build a project as a team and play together (2026-10-24).
- The runtime is deterministic and seeded; the server is HTTP-only; the web is a PWA with Capacitor planned.
- The platform has no organizer/teacher role.

## Decision

1. **Group mode is allowed as a closed, ephemeral, same-room feature**, created and moderated by one adult **organizer**. ADR 0009 stays in force for everything public: no public URLs, galleries, discovery, comments, likes, remix or chat.
2. **Transport: WebRTC data channels, star topology, organizer device as host and lockstep sequencer, in-person exchange of complete signaling bundles by QR, direct local connection first.** A short code requires the optional online signaling mailbox. The server gains no realtime game surface. Local connection on isolated school Wi-Fi is not guaranteed.
3. **Sync by ordered inputs** with a shared seed, relying on the deterministic runtime. Cooperative and turn-based games first.
4. **No direct in-app conversation.** No chat, phrases, free text, voice or direct image messages between children (consistent with ADR 0009); they talk out loud in the same room. Only optional fixed emoji reactions. A project asset may be shared within the closed group only after screening and organizer approval.
5. **AI pre-filter, local only, fail closed, with an organizer approval queue** for any human-created content shown to the group (images, names). No remote moderation model without a new ADR.
6. **Identity: generated alias from a fixed list.** No name, email, school, location or photo. Nothing about the group or aliases is sent to Ori or any provider.
7. **New role `organizer`**: an existing adult account (verified email) with an organizer capability. **The account is mandatory** to start any group (owner decision, 2026-10-24).
8. **Closing a group deletes ephemeral group data.** An explicitly exported `.agorix` file remains on its device and must be deleted separately; there is no server project copy.
9. **All AI-parametrized settings of group mode (moderation models and thresholds, blocklists, reactions, limits, relay flag) are admin-editable, versioned and persisted in the database** via the registry of issue #545. Secrets stay outside it; invalid or missing configuration fails closed.
10. **An optional, budget-limited relay is accepted as fallback** when direct local connection fails: a signaling mailbox on the existing HTTP server (offer, answer and ICE candidates, short-lived) plus STUN and TURN carrying encrypted packets. TURN's free allowance is finite and charges can apply; enabling it in production requires a privacy review and budget controls first. No game or project content is stored by the relay service.

## Consequences

- Game inputs use no server by default. Optional online signaling and TURN add limited server and network-metadata surfaces, reviewed separately before activation.
- Starting a group needs Internet once for the organizer's sign-in; play can then continue locally if peers can reach one another. Schools with client isolation need the online relay or a hotspot, and the UI must explain a failed connection.
- The current `camera=()` policy blocks in-app QR scanning. F3 requires a narrowly scoped permissions review and a tablet spike; QR bundle size and cross-device ICE are not yet proven.
- Free tiers have limits: sessions are capped in size, duration and rate.
- A new role means changes in `auth-service` and the adults flows (F1), and a legal review for the organizer acting for children who are not their own.
- The host must validate and rate-limit every input from other devices.
- Reviewers reject PRs that add free-text child communication, public URLs, discovery or server storage of group content to Kids.

## Alternatives considered

Full cloud WebSocket relay as the main transport (not local, new server surface; only the minimal fallback above is accepted); local server on the organizer device (not possible in a browser, native plugin burden); Bluetooth/Nearby/mDNS discovery (not cross-platform).
