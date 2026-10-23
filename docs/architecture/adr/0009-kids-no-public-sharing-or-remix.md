# ADR 0009: No public sharing or remixing in Agorix Kids

## Status

Accepted on 2026-10-23 by the product owner (issue #472, epic #436). The prototype v2
HANDOFF section 6d lists "Compartir y remezclar: fuera por privacidad, o detrás de la cuenta de
adulto" as an open question. This ADR records the recommended answer.

## Context

- `docs/safety/CHILD_SAFETY_PRIVACY.md`: no public profile, no public chat, no real name, school,
  address or photo. The Kids design (`docs/superpowers/specs/2026-10-21-agorix-kids-design.md`) keeps
  "no public chat".
- Sharing and remixing (Scratch style) needs a public namespace, discovery, moderation, abuse
  reporting and takedown. Each is a child-safety surface Agorix does not have.
- Projects already travel safely as validated `.agorix` v1 files (export/import in the Projects
  screen), handled by an adult-visible file, not by a public service.

## Decision

1. **Kids has no public sharing, discovery, comments, likes or remixing of other people's projects.**
   Not in the app, not behind a flag.
2. The only supported way to move a project is the existing `.agorix` file export/import. Importing
   always creates a separate local copy and is validated (size, schema, goal spec).
3. If sharing is ever wanted, it must go through the adult account (see the link design,
   issue #471) as an **adult-initiated export of a `.agorix` file to a named person**, with no public
   URL, no search and no child-authored text. That is a new ADR and a privacy review first.
4. `prototipo/v2/README.md` marks "Compartir y remezclar" as **decided: out**.

## Consequences

- Nothing to build for this item. Reviewers should reject PRs that add public URLs, share links,
  galleries or remix buttons to Kids.
- Mora can still hand a `.agorix` file to a friend; an adult does it.
- Revisit only with a classroom mode and a moderation plan.
