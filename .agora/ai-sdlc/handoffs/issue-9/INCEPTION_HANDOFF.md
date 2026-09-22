---
schema: "agora-ai-sdlc/inception-handoff/v1"
intent: "issue-9"
issue: "https://github.com/Modern-Ash/agorix/issues/9"
runtime: "claude"
status: "prepared"
---

# Inception handoff — issue-9

## Objective

Define child-facing content, feedback and first-mission copy

## Authority

Follow the installed Agora AI-SDLC guided skill. Agora Core remains lifecycle authority.
Skill: `/home/faguero/dev-agora/agora-ai-sdlc/skills/agora-ai-sdlc-guided/SKILL.md`
Load only the Inception resource: `/home/faguero/dev-agora/agora-ai-sdlc/skills/agora-ai-sdlc-guided/references/inception.md`.
Human observation logs are not agent context; do not load or replay them.

## Required inputs

- Durable Intent: `.agora/intents/issue-9/INTENT.md`
- Source issue: https://github.com/Modern-Ash/agorix/issues/9
- Repository AGENTS.md and bounded product/architecture context referenced by the issue

## Required Inception output contract

Return and, where existing AI-SDLC contracts permit, persist all of:

1. Intent interpretation.
2. Material clarifications requiring human decision.
3. Level 1 Plan.
4. Cohesive Units.
5. Suggested Bolts.
6. Acceptance criteria traced to the source issue.
7. Risks, constraints and dependencies.
8. Explicit distinction between source facts and proposed product decisions.
9. Files created or modified.
10. Human decision required to continue.

## Stop conditions

- Do not enter Construction.
- Do not implement product code.
- Do not fabricate or infer human approval.
- Stop on material ambiguity and ask one bounded decision question.
- Stop after presenting the complete Inception proposal for human review.

## Runtime

Selected executor interface: Claude Code (`claude`).
Runtime selection changes who executes this handoff, never the method semantics.
