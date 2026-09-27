# Agorix Worlds architecture

## Purpose

Agorix Worlds are the shared narrative and visual layer for missions. A World gives the learner a
place, character framing, objective language and visual feedback, while the canonical program,
runtime and curriculum keep owning programming semantics.

Worlds make a mission feel like an experience without turning Agorix into separate product forks
or a generic game engine.

## Core boundary

```text
World
  visuals
  narrative
  characters
  mission framing
        |
        v
Mission contract
        |
        v
Canonical Program + Runtime
```

The World is content and rendering guidance. It never becomes the source of truth for accepted
program state, runtime operations, mission completion or generated code.

## Naming note

The current `@agorix/runtime` package has a `WorldState` type for generic execution state:
sprite position, heading and goal position. Agorix Worlds are a product/content concept above
that runtime state.

Use this distinction consistently:

- `WorldState`: deterministic runtime state.
- `Agorix World`: narrative/visual theme and asset contract for presenting a mission.

## Contract

A World definition must be serializable and renderer-neutral. It should contain:

| Field              | Meaning                                                              |
| ------------------ | -------------------------------------------------------------------- |
| `id`               | Stable locale-independent world id, such as `space.trailhead`.       |
| `version`          | Integer world contract version.                                      |
| `defaultLocale`    | Fallback locale for display copy and asset metadata.                 |
| `supportedLocales` | Locales that have complete learner-facing copy.                      |
| `concepts`         | Concepts the world is good at motivating, such as movement or loops. |
| `visualStyle`      | Renderer guidance: palette role, environment, density and tone.      |
| `characters`       | Character roles and names used in mission framing.                   |
| `assetCatalog`     | Asset references with source, license, attribution and variants.     |
| `motionPolicy`     | Default animation and reduced-motion behavior.                       |
| `missionBindings`  | Mission ids/versions that can use the world.                         |

World definitions may include renderer hints, but renderer hints must be optional. Web, Studio
Preview and future mobile surfaces may render the same world with different density and host chrome.

## Mission-to-world association

Mission identity is stable and locale-independent. A mission may declare or be associated with:

- a default World;
- optional alternate Worlds for the same semantics;
- localized display copy;
- world-specific narrative framing;
- asset variants for locale, theme or accessibility.

The following must not change when switching Worlds:

- mission `id`;
- mission `version`;
- canonical starter program semantics;
- completion predicate;
- runtime observation semantics;
- Learning Companion structured fields;
- LanguageProjection node mappings.

Worlds may reframe the same action in learner-facing language. For example, "reach the goal" may
look like flying to a beacon in Space or swimming to a marker in Ocean. The predicate remains the
same unless a future issue adds a generic domain capability and updates curriculum explicitly.

## Asset and theme boundary

Assets are not logic. A world asset can change:

- background art;
- sprite or character artwork;
- goal marker artwork;
- success/failure state illustration;
- short display labels;
- ambient decoration;
- animation timing within the motion policy.

Assets must not change:

- canonical program nodes;
- runtime movement math;
- mission completion predicates;
- hidden hit boxes that differ from runtime state;
- locale-independent IDs;
- accepted program state.

If a future world needs a new concept, such as collecting items, events, variables, functions or
concurrency, that concept must first be represented as an explicit generic domain capability in the
curriculum/runtime/program model path. It must not be smuggled in as world-specific renderer logic.

## Localization

Localization affects display content, not machine identity.

Localized World content may include:

- title and description;
- character names where culturally appropriate;
- objective framing;
- success and retry copy;
- alt text;
- asset variants when symbols or text appear inside art.

Localized World content must not include:

- translated mission ids;
- translated world ids;
- localized canonical node types;
- locale-specific runtime predicates;
- locale-specific provider fields.

## Cross-surface rendering

Web and Studio World Preview must render from the same shared inputs:

```text
MissionDefinition
WorldDefinition
Runtime WorldState
Runtime observations
Locale
Motion/accessibility preferences
```

Web may prioritize touch, large targets and immersive world framing. Studio Preview may prioritize
compact IDE density, debugging evidence and code adjacency. Both surfaces must preserve the same
mission semantics and runtime evidence.

Studio must not embed a separate Scratch-like game editor. It can preview the World, inspect
runtime observations and connect them to code/debug surfaces.

## Progression rules

Worlds support learner progression by changing framing and affordances gradually:

1. Beginner missions use strong visual goals, small action palettes and simple success feedback.
2. Intermediate missions introduce richer objectives while keeping code and runtime evidence
   visible.
3. Advanced missions may show more debugging evidence, traces and Studio affordances.

Progression changes surface complexity, not semantic truth. A learner moving from Web to Studio
keeps the same project, mission identity, runtime behavior and accepted canonical program.

## Starter World: Space Trailhead

`space.trailhead` is the initial World for `first-mission.reach-goal`.

| Property         | Specification                                                         |
| ---------------- | --------------------------------------------------------------------- |
| World id         | `space.trailhead`                                                     |
| Mission binding  | `first-mission.reach-goal@1`                                          |
| Concepts         | sequence, events, movement                                            |
| Narrative frame  | Help a small explorer travel from the launch pad to a beacon.         |
| Sprite role      | Explorer ship or rover, represented by the existing runtime sprite.   |
| Goal role        | Beacon, represented by the existing runtime goal.                     |
| Primary feedback | Movement toward beacon, stopped short, passed beacon, reached beacon. |
| Completion       | Existing `spriteTouchingGoal` predicate.                              |
| Required blocks  | Existing Move path is sufficient.                                     |

### Reduced motion

In full motion, the explorer may glide from runtime frame to runtime frame and the beacon may
pulse when reached. With `prefers-reduced-motion: reduce`:

- decorative pulses and ambient movement are disabled;
- sprite position updates may jump or crossfade near-instantly;
- success remains visible through text, icon/shape and stable highlight;
- retry feedback remains textual and non-color-only;
- runtime evidence and code highlights remain available.

### Accessibility

The starter World must provide:

- non-color-only goal reached feedback;
- alt text for decorative and meaningful assets;
- stable focus order around Run, Step, Reset, Action Palette and reflection controls;
- readable labels in English and Spanish;
- no critical interaction that requires drag, hover or long press.

## Asset and license requirements

Every asset shipped with a World must have:

- source repository or creation method;
- license;
- attribution text when required;
- modification notes when edited;
- localization status;
- reduced-motion alternative when animated;
- replacement guidance for downstream schools or families.

Open-source-friendly assets are preferred. Avoid assets whose license prevents redistribution,
classroom use, remixing for localization or inclusion in exported project templates.

Generated assets must record the tool/provider, prompt summary, date, editor and any post-processing
steps that materially affect the output. Do not include child personal data, school identifiers or
private prompts in asset metadata.

## Acceptance trace

| #119 acceptance criterion                                             | Worlds architecture answer                                                                                              |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Adding a World does not require changing canonical program schema     | Worlds are content/theme definitions above Mission and Runtime; schema changes require separate generic domain work.    |
| Mission identity remains locale-independent                           | Mission IDs, world IDs, versions and predicates are stable; localization affects display copy and assets only.          |
| World assets can be localized/themed without logic forks              | Asset variants are catalog entries and cannot change runtime math, predicates or canonical nodes.                       |
| Same mission semantics can render across Web and Studio World Preview | Both render from MissionDefinition, WorldDefinition, runtime state, observations, locale and accessibility preferences. |
| Initial World has accessible reduced-motion behavior                  | `space.trailhead` specifies reduced-motion, non-color-only feedback and no drag-only critical interaction.              |
| Assets/license requirements are documented                            | Asset source, license, attribution, localization, reduced-motion and replacement requirements are listed above.         |

## Non-goal

Agorix Worlds are not a generic game engine. They are a learning-mission presentation layer for
shared programming semantics.
