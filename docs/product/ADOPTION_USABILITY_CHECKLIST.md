# Adoption usability checklist (issue #203)

## Purpose

Release gate for the visual-programming epic (#196). Automated journeys prove the interaction matrix and the canonical authority boundaries (`apps/web/e2e/adoption-gate.spec.ts`, `apps/web/e2e/input-parity.spec.ts`, plus the #104 transparency journey in `smoke.spec.ts`). This checklist covers what automation cannot: whether a person already familiar with Scratch recognizes the grammar and understands the AI-native semantics.

## Status

**Human session: PENDING. Not yet executed.** No participant has been run and no result below is real. The observation table is a blank template. The "human familiarity checklist completed/documented" acceptance item of #203 stays open until a person fills it in.

## Protocol (Scratch-familiar participant)

- Participant: one person who has already used Scratch (or similar block editor). Moderated or unmoderated, 10-15 minutes.
- Privacy: record no name, age, contact, audio or video of the participant. Use a participant code (P1, P2) and only the self-reported label "Scratch-familiar". Record observations about the product, not the person.
- Setup: fresh browser profile (empty local storage), tablet or desktop, AI in default local mode, no provider connected. Do not explain palette, categories, drag, insertion point, Run/Stop or the AI panel beforehand.
- Prompt: "Make the sprite reach the goal. Think aloud if you like." Intervene only if blocked for over 2 minutes; log every intervention.
- Closing questions (ask in this order):
  1. "What did the AI suggestion do to your program when it appeared?"
  2. "If the AI said the program works, would that prove it?"

## Success criteria and observation template

Mark each row Yes / Partial / No, with a short factual note. Leave blank until a real session happens.

| #   | Criterion                                                                     | Result | Observation (what was seen/said, not who) | Intervention needed |
| --- | ----------------------------------------------------------------------------- | ------ | ----------------------------------------- | ------------------- |
| 1   | Recognizes palette and categories without explanation                         |        |                                           |                     |
| 2   | Discovers drag-to-program                                                     |        |                                           |                     |
| 3   | Understands the insertion point                                               |        |                                           |                     |
| 4   | Can edit a value inline                                                       |        |                                           |                     |
| 5   | Can reorder and delete blocks                                                 |        |                                           |                     |
| 6   | Can Run and Stop                                                              |        |                                           |                     |
| 7   | Can explain that an AI suggestion is optional and not yet applied             |        |                                           |                     |
| 8   | Does not treat AI text as proof of runtime behavior (runtime result is proof) |        |                                           |                     |

Session record (fill in after a real run): date, device/viewport, participant code, build/commit, total time to Mission complete, free-form friction notes, follow-up issues opened.

## Gate rule

The epic closes only when this table has real results with no unresolved "No" on criteria 7 or 8, and any "No" elsewhere has a linked follow-up issue.
