# Non-functional Requirements - issue #76

- Determinism: the same canonical program and initial world must produce the same Step sequence every time.
- Surface parity: Web and Studio may present stepping differently, but their canonical node ids and observations must match.
- Accessibility: Step must be keyboard accessible and touch-first, with controls usable in narrow tablet layouts.
- Safety: Step must not race with Run, and editing/resetting must clear stale execution state.
- Traceability: tests must prove simple, repeat and conditional stepping behavior and link highlights to projection mapping.
