# Ori pedagogical A/B — comparable context gate

This increment prevents educator comparisons from silently treating the five Scratch-inspired fixtures as equivalent to the current three canonical Kids missions.

## Findings

- The actual Kids curriculum exposes three mission IDs (`KIDS_MISSION_IDS`), indexed 0–2.
- The evaluation fixtures use indices 1–5. Under the current contracts, only indices 1 and 2 can match canonical Kids mission indices, and only if the mission ID and hint level also match.
- The deterministic rule provider returns structured offers and proposals. Ori's shadow plan returns pedagogical hint text and steps. They are different output types.
- An opaque SHA-256-shaped program fingerprint is required as metadata, but its mere presence does not prove that two providers actually received identical program content.

## Next release gates

1. Create a reproducible synthetic program for each selected canonical Kids mission and compute the fingerprint from its serialized canonical representation.
2. Execute the actual deterministic tutor and Ori against explicitly aligned contexts; capture the input traces and distinguish structured proposals from authored hint text.
3. Define a justified, separately reviewed comparison target: either compare equivalent text-generating tutor paths or use different pedagogical criteria for text and structured offers.
4. Expand the canonical curriculum or revise the fixture mapping before claiming that all five evaluation topics are directly comparable.
5. Keep source mappings blinded until educator scoring is complete.

This is evidence validation only. It does not activate Kids or assert that a fingerprint proves provenance.
