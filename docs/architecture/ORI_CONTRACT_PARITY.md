# Ori ↔ Agorix shadow-plan consumer contract

## Scope

This is a consumer-driven **synthetic fixture** suite in Agorix's isolated `integration/ori` workstream. It mirrors the producer shape from `Modern-Ash/ori` PR #47 (`src/shadow-plan.mjs`).

## Contract

`ori/shadow-plan/v1` contains a three-step generic educational plan, one short hint, a stage (1–5), `appliedChanges: false`, `requiresLearnerApproval: false` and mission-stage metadata. Extra fields are rejected.

## What the tests establish

- The Agorix validator accepts fixtures for all five Ori stages.
- Empty/nonempty synthetic programs select the expected generic hint.
- Changed schema versions, privileged proposals and child identifiers fail closed.

## What the tests do NOT establish

- No live producer/consumer interoperability: Ori #47 remains a separate PR.
- No security certification or actual child data testing.
- No child-facing plan rendering, runtime evidence or program editing.
- No automatic schema synchronization: future work should share a versioned fixture artifact and run it against both repositories in CI.

## Gate

Do not promote to `main` or `development`. Keep all responses discarded in shadow mode. Before consuming them, add live loopback integration, independent safety review and explicit approval.
