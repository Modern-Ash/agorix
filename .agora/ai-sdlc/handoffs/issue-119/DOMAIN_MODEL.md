# Domain Model

## Entities

- World: locale-independent content/theme identity that frames a mission visually and narratively.
- World Theme: renderable palette, environment, characters, animation rules and asset catalog for
  one World.
- World Asset: referenced image, audio, animation or textural element with license metadata and
  localized/themed variants.
- Mission Association: stable mapping from mission id/version to a default world and optional
  alternative worlds.
- World Preview: renderer-specific projection of mission, runtime frame and world theme for Web
  or Studio.

## Boundaries

- World content does not change canonical program schema.
- World content does not define runtime operations.
- Mission completion remains in curriculum predicates and deterministic runtime state.
- Locale changes affect learner-facing copy and asset variants only.
