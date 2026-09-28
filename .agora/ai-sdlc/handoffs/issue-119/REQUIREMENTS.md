# Requirements

## Functional requirements

- R1: `docs/product/WORLDS.md` defines Agorix Worlds as narrative/visual content over missions.
- R2: The Worlds contract states that adding a world must not require canonical program schema
  changes.
- R3: Mission identity remains locale-independent; localized title, copy and assets are display
  projections only.
- R4: World assets can vary by locale, theme and accessibility mode without changing mission
  predicates or runtime semantics.
- R5: The same mission semantics can render in Web and future Studio World Preview through a
  shared contract.
- R6: The starter world specification covers the existing First Mission.
- R7: Reduced-motion behavior is specified for the starter world and future worlds.
- R8: Asset source, license, attribution and replacement requirements are documented.

## Non-goals

- Do not create a generic game engine.
- Do not execute generated code or world scripts.
- Do not add provider-specific, UI-specific or locale-specific fields to canonical programs.
