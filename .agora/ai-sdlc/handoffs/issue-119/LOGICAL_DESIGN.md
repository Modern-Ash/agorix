# Logical Design

## Flow

```text
Mission id/version
  -> world association
  -> world/theme catalog
  -> renderer input
  -> Web World surface or Studio World Preview
```

Runtime flow remains separate:

```text
Canonical Program
  -> Runtime
  -> WorldState / observations
  -> Mission evaluation
```

## Design decisions

- Use stable IDs for missions and worlds.
- Treat localized content and asset variants as display projections.
- Require any new runtime capability to be generic before a world can use it.
- Preserve reduced-motion and non-color-only feedback in every world.
- Keep expressive visual energy inside the World surface, not global product chrome.
