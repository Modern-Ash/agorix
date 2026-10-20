---
schema: "agora-ai-sdlc/inception-handoff/v1"
intent: "issue-340"
issue: "https://github.com/Modern-Ash/agorix/issues/340"
runtime: "codex"
status: "prepared"
---

# Inception handoff — issue-340

## Objective

Web prod: container image serving apps/web/dist with security headers

## Authority

Follow the installed Agora AI-SDLC guided skill. Agora Core remains lifecycle authority.
Skill: `/home/faguero/dev-agora/agora-studio/.venv/lib/python3.14/site-packages/agora_ai_sdlc/skills/agora-ai-sdlc-guided/SKILL.md`

## Required inputs

- Durable Intent: `.agora/intents/issue-340/INTENT.md`
- Source issue: https://github.com/Modern-Ash/agorix/issues/340
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

Selected executor interface: Codex (`codex`).
Runtime selection changes who executes this handoff, never the method semantics.
