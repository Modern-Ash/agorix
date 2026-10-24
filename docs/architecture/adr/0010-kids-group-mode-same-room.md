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
2. **Transport: WebRTC data channels, star topology, organizer device as host and lockstep sequencer, in-person QR or short-code pairing, no signaling server, direct local connection first.** The server gains no realtime surface.
3. **Sync by ordered inputs** with a shared seed, relying on the deterministic runtime. Cooperative and turn-based games first.
4. **No in-app communication.** No chat, phrases, free text, voice or images between children (consistent with ADR 0009); they talk out loud in the same room. Only optional fixed emoji reactions.
5. **AI pre-filter, local only, fail closed, with an organizer approval queue** for any human-created content shown to the group (images, names). No remote moderation model without a new ADR.
6. **Identity: generated alias from a fixed list.** No name, email, school, location or photo. Nothing about the group or aliases is sent to Ori or any provider.
7. **New role `organizer`**: an existing adult account (verified email) with an organizer capability. **The account is mandatory** to start any group (owner decision, 2026-10-24).
8. **Closing a group deletes all group data.** The team project is a normal local `.agorix` file; there is no server copy.
9. **All AI-parametrized settings of group mode (moderation models and thresholds, blocklists, reactions, limits, relay flag) are admin-editable, versioned and persisted in the database** via the registry of issue #545. Secrets stay outside it; invalid or missing configuration fails closed.
10. **A minimal, free-cost relay is accepted as fallback** when direct local connection fails: a signaling mailbox on the existing HTTP server (offer/answer only, short-lived) plus free STUN and a free-tier TURN relay carrying only encrypted packets. No game or project content is stored. Enabling it in production requires a privacy review first.

## Consequences

- No new server infrastructure for play; the privacy surface stays on the room's network.
- Starting a group needs Internet once for the organizer's sign-in; play can then continue locally. Schools with client isolation use the minimal relay or a hotspot, and the UI must explain a failed connection.
- Free tiers have limits: sessions are capped in size, duration and rate.
- A new role means changes in `auth-service` and the adults flows (F1), and a legal review for the organizer acting for children who are not their own.
- The host must validate and rate-limit every input from other devices.
- Reviewers reject PRs that add free-text child communication, public URLs, discovery or server storage of group content to Kids.

## Alternatives considered

Full cloud WebSocket relay as the main transport (not local, new server surface; only the minimal fallback above is accepted); local server on the organizer device (not possible in a browser, native plugin burden); Bluetooth/Nearby/mDNS discovery (not cross-platform).
