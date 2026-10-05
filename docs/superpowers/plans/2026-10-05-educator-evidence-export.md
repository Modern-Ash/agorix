# Educator evidence export Implementation Plan

> For agentic workers: REQUIRED SUB-SKILL: superpowers:executing-plans. Spec: `docs/superpowers/specs/2026-10-05-educator-evidence-export-design.md`

## Review Focus
- No free text, paths, emails or ids of people in the export (test).
- Cancel at either dialog writes nothing.
- Truncation flagged at the 200-event cap.

## Tasks
1. Events: new types + `origin` in `agent-workflow`; record in `agentHost`.
2. Pure builder/validator/summary in `learning-evidence`.
3. Command, session wiring, `package.json`, wiring test.
4. Docs, full verification.
