# Real Agorix deterministic baseline — evidence boundary

This increment executes the actual `computeKidsOri` deterministic rule provider against the canonical Kids mission starter programs, without modifying them. The resulting records contain the real mission ID, rule outcome kind, optional amount, proposal presence and a program immutability check.

## Important architectural finding

The current canonical Kids curriculum has three mission IDs, while the separate Ori pedagogical evaluation fixture set has five topics (movement, sequence, loops, events and debugging). They do not map one-to-one. Furthermore, `computeKidsOri` returns a structured program offer and reviewable proposal, **not** a `hint` and `nextStep` pair. Automatically converting these structured offers into authored hints would introduce another generator and invalidate a naive same-input A/B comparison.

The PR therefore does not fabricate deterministic tutor text or claim to complete five pedagogical A/B cases. The next increment must define aligned canonical synthetic programs for the five topics, choose the actual deterministic text-generation path, and verify identical pedagogical context before constructing blind pairs.

No Kids route, UI, rollout flag or production deployment is changed.
