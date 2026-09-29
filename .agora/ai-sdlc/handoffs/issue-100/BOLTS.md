# Issue 100 Bolts

## Bolt A: Validation Boundary

- Define shared validation result, safe child message, and developer diagnostic shapes.
- Validate parsing/schema/capability/scaffolding/program/content/provenance layers.

## Bolt B: Runtime Integration

- Wire fake/local/remote provider outputs through the same boundary.
- Ensure rejected output cannot enter learner UI as accepted state or mutate canonical program.

## Bolt C: Adversarial Fixtures

- Add fixtures for malformed schema, full-solution over-assistance, PII seeking, unsafe program operation, hidden tool action, and provenance mismatch.
- Cover local/fake and remote paths without credentials.

## Bolt D: Evidence And Checklist

- Add security-oriented test matrix and review checklist.
- Capture deterministic commands and CI-ready evidence.
- Note AI-SDLC economics: cheap-first, no frontier auto, usage only from telemetry.
