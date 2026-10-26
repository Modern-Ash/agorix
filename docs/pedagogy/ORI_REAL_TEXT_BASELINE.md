# Ori vs Agorix — authentic deterministic text baseline

The actual Agorix text-tutor path is `createDeterministicTutorResponse` in `@agorix/tutor-contract`. Unlike the Kids structured `computeKidsOri` rule, it produces a validated `TutorResponse.message` using mission, program, runtime and hint history.

This increment executes that real function on a synthetic canonical Kids mission with an actual runtime trace. It records source, mission, hint level, message and program immutability. No artificial hint text or `nextStep` is constructed.

## Comparison boundary

The deterministic text tutor returns one message; the Ori shadow preview returns a hint and first step. They are not directly equivalent two-field candidates. Additionally, the text tutor sees the actual program and runtime, while Ori's current shadow endpoint sees only three metadata fields.

A scientifically defensible study must either compare **single-message hints** under documented different-information conditions, or design a truly shared neutral input protocol for both. Do not silently invent a second step or assert same-input equivalence.

No Kids route, UI or production behavior is modified. This remains a synthetic offline evidence component on `integration/ori`.
