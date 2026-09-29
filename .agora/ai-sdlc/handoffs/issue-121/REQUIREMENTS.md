# Requirements

## Functional requirements

- R1: Web-created stored project opens in Studio using the shared project contract.
- R2: Studio-created or Studio-modified canonical project reopens through Web-compatible persistence.
- R3: Semantic hash/equivalence is preserved through Web -> Studio -> Web round trip.
- R4: Unsupported newer schema fails explicitly.
- R5: Presentation-only state does not enter canonical program state.
- R6: Locale changes remain independent from canonical program semantics.
- R7: UI-specific identifiers do not leak into canonical model.

## Deliverables

- Cross-surface compatibility contract.
- Project serialization/version rules and migration policy.
- Deterministic compatibility fixtures.
- Automated round-trip tests.
