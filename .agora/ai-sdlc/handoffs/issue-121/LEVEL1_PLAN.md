# Level 1 Plan

## Goal

Prove the Web/Tablet and Agorix Studio surfaces share project semantics through deterministic fixtures and automated round-trip tests.

## Steps

1. Define cross-surface compatibility contract and serialization/version rules.
2. Define semantic hash/equivalence rules over canonical semantic fields.
3. Add compatibility fixtures representing Web-created and Studio-modified projects.
4. Add automated tests for Web -> Studio -> Web round trip.
5. Add failure-path tests for unsupported newer schema.
6. Add tests proving presentation state and locale preferences do not contaminate canonical program semantics.
7. Run repository verification and record evidence.
