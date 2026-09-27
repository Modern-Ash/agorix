## Non-functional Requirements

- NFR-001: Safety: translated safety-critical copy must retain the same protective meaning across locales.
- NFR-002: Determinism: fallback locale resolution must be stable and testable.
- NFR-003: Semantic integrity: product locale must not affect canonical program, runtime state, persisted code, AST, or hashes.
- NFR-004: Maintainability: localization keys must be organized by product surface and validated for completeness.
- NFR-005: Extensibility: a third locale must not require changes to canonical program/runtime code paths.
- NFR-006: Accessibility: locale selector and localized controls must be reachable and understandable to assistive technologies.
- NFR-007: Layout resilience: Spanish copy must fit existing desktop and mobile layouts without overlapping controls.
- NFR-008: Developer feedback: missing or invalid catalog entries must be visible in local verification and CI.
- NFR-009: Minimal blast radius: implementation should fit current React/Vite and TypeScript package boundaries.
