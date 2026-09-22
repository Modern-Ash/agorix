---
schema: "agora/unit-of-work/v1"
id: "issue-9-content-guide"
intent: "issue-9"
work: "delivery/first-work"
source: "https://github.com/Modern-Ash/agorix/issues/9"
---

# Unit of work: Issue #9 content guide

## Scope

Draft and publish `docs/product/CONTENT_GUIDE.md`, a single consistent child-facing
language system for the Agorix POC editor.

## In scope

- Tone/reading-level principles for a child audience.
- Copy for: block/toolbox labels; Run/Stop/Reset controls; the generated-code panel
  explanation; mission intro; retry/error states; success state; tutor-unavailable
  state; the five-level hint ladder; the reflection prompt.
- A "wording to avoid" list.
- Mapping from deterministic runtime errors (per MVP.md "Runtime") to child-facing
  messages.

## Out of scope

- Any UI/layout implementation (covered by issue #8 / LEARNER_JOURNEY.md).
- React component work.
- Localization/translation beyond the primary language.

## Source material

- docs/product/PEDAGOGY.md — hint ladder, feedback philosophy, reflection.
- docs/product/MVP.md — required blocks, runtime, persistent code bridge.
- docs/safety/CHILD_SAFETY_PRIVACY.md — no PII prompts, tutor-fallibility disclosure.

## Dependencies

None. Independent of issue #8's IA work; both feed the same editor.
