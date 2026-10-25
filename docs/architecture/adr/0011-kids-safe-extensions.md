# ADR 0011: Kids safe extensions

## Status

**Proposed** on 2026-10-25 (issue #737, from #538). Becomes Accepted only after product owner approval. It adds no code; each pack below needs its own issue, spec and PR.

## Context

- Scratch extensions (Pen, Music, Text to Speech, Translate, Video Sensing, hardware kits) add blocks that reach outside the sandbox: network, camera, microphone, speakers, Bluetooth, third-party code.
- Kids rules say a project runs without AI or network, the runtime is deterministic, nothing a child types is stored as free text, no secret or child data leaves the device (`docs/safety/CHILD_SAFETY_PRIVACY.md`), and ADR 0009 forbids public sharing and remixing.
- Everything a Kids program can do today is a statement or expression of the canonical model (`program-model`) that the runtime executes and the projections, blocks and validators know. Custom blocks (#538) are compositions of those, not new capabilities.

## Decision

1. **An extension is a first-party, versioned capability pack shipped in the app build.** It is data and code reviewed in this repository. There is no third-party extension, no loading from a URL, no code supplied by a child, an adult or a project file, and no marketplace.
2. **A pack may only add canonical statements and expressions.** Each one gets, in the same PR, a model type and validator, a runtime semantic that is deterministic (same program and inputs, same result), projections (Agorix Code, Python, TypeScript), a block, a Studio control, a trace entry and tests. A pack cannot add a back door around the model: a block that the runtime does not execute, or that executes differently from its projection, is rejected.
3. **Forbidden capabilities.** No network, no camera, microphone, geolocation, clipboard, file access, Bluetooth/USB/serial hardware, notifications, speech recognition or synthesis, machine translation, and no AI call from inside a running program. Anything that needs one of these is a separate ADR, not a pack.
4. **Allowed capabilities** are deterministic, local and bounded: they change world state the runtime already owns (a drawn trail, a list of notes), or play bundled assets through the existing sound path. Every pack declares hard limits (items, steps, size), and exceeding one stops the pack's work with a note, never the app.
5. **Declared per project.** A program lists the packs it uses (`extensions: ["pen"]`, ids from a fixed list, at most four). The validator rejects an unknown id, a block whose pack is not declared, and a project whose pack version is newer than the app. Import and export carry only ids and versions; a project from a newer app opens read-only with a clear message.
6. **Adults control availability.** Each pack has a feature flag, off by default until accepted, using the existing flag and admin-registry mechanism (#545). Turning a pack off hides its blocks and refuses new use; saved projects keep working through the declared list and show the blocks as unavailable rather than deleting them.
7. **Ori sees pack ids only.** Ori may be told which packs are enabled and suggest a block by type, never any child text, title, name or drawn content, and every suggestion remains a reviewable proposal (AGENTS.md).
8. **No child free text.** A pack must not store text typed by a child. Text becomes pixels or one of a closed set of choices.
9. **Privacy and security review per pack,** recorded in its PR: data touched, limits, failure modes, accessibility (44 px targets, keyboard, axe), mobile test, reopen test, and a fresh-browser default check.

## First candidates (each its own issue)

| Pack  | Adds                                                                     | Why it fits                                                                     |
| ----- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| Pen   | pen down/up, colour, size, stamp, clear: a trail kept in the world state | deterministic, local, no new input; the trail is part of the run result         |
| Music | play a note for a beat, tempo, instrument from the bundled sound library | aligns with the sound epics (#621–#626); notes are closed numbers, no recording |

Not candidates under this ADR: Text to Speech, Translate, Video Sensing, Makey Makey, micro:bit, LEGO and any network or hardware pack.

## Consequences

- Extensions cost as much as a core feature (model, runtime, three projections, blocks, Studio, tests). This is intended: a pack is never cheaper than the evidence that it is safe.
- The program schema gains an optional `extensions` list and a version rule; saved projects without it are unchanged.
- Reviewers reject PRs that load code or data by URL, accept pack definitions from project files, add a forbidden capability, or add a block without runtime, projection and tests.
- Kids cannot do what Scratch's hardware and cloud extensions do. That is a deliberate limit of the product, recorded here so it is not rediscovered as a gap.

## Alternatives considered

Sandboxed third-party extensions in an iframe or worker (large attack surface, cannot be made deterministic or kept offline, and a child could install untrusted code); a plugin API for adults (same risk plus a support burden); no extensions at all (loses Pen and Music, which add real creative value inside the current safety model).
