---
schema: "agora-ai-sdlc/inception-handoff/v1"
intent: "issue-75"
issue: "https://github.com/Modern-Ash/agorix/issues/75"
runtime: "codex"
swarm: "issue-75-delivery"
work: "issue-75"
branch: "feat/issue-75-proposal-review-boundary"
base-branch: ""
pathway: "brownfield"
project-root: "/home/faguero/dev-agora/.agorix-main-issue75"
status: "prepared"
---

# Inception handoff — issue-75

## Objective

Implement structured AI proposal preview, diff and learner acceptance boundary

## Authority

Follow the installed Agora AI-SDLC guided skill. Agora Core remains lifecycle authority.
Skill: `.agora/skills/agora-ai-sdlc-guided/SKILL.md`
Load only the Inception resource: `.agora/skills/agora-ai-sdlc-guided/references/inception.md`.
Human observation logs are not agent context; do not load or replay them.

## Required inputs

- Project root: `/home/faguero/dev-agora/.agorix-main-issue75`
- Executor must verify its current working directory resolves exactly to this project root before changing files.
- Durable Intent: `.agora/intents/issue-75/INTENT.md`
- Governed Work: `issue-75-delivery/issue-75`
- Work branch: `feat/issue-75-proposal-review-boundary` (base: `unknown`)
- Adaptive pathway: `brownfield`
- Source issue: https://github.com/Modern-Ash/agorix/issues/75
- Repository AGENTS.md and bounded product/architecture context referenced by the issue

## Deterministic draft

- Draft: `.agora/ai-sdlc/handoffs/issue-75/DETERMINISTIC_INCEPTION.md`
- Treat this Python-generated draft as the baseline; do not re-explore the repository or recreate facts already present there.
- Only resolve the semantic gaps listed below and preserve deterministic facts unless authoritative evidence contradicts them.
- Semantic gap: none

## Required Inception output contract

Return and, where existing AI-SDLC contracts permit, persist all of the following.
The final response must use these exact Markdown H2 headings:

1. `## Intent interpretation`
2. `## Material clarifications`
3. `## Level 1 Plan`
4. `## User Stories`
5. `## Non-functional requirements`
6. `## Measurement Criteria`
7. `## Proposed Units` (Cohesive Units where decomposition adds execution value)
8. `## Suggested Bolts`
9. `## Acceptance criteria trace`
10. `## Risk Register`
11. `## Risks, constraints and dependencies`
12. `## Source facts and proposed decisions`
13. `## Files created or modified`
14. `## Human decision required`

Every section must contain substantive content and the proposal must remain grounded in the Objective above.
PRFAQ is optional: propose it only when a customer/business narrative materially improves alignment.

## Stop conditions

- Do not enter Construction.
- Do not implement product code.
- Do not fabricate or infer human approval.
- Do not ask the human to reconfirm a decision already fixed by the source issue or referenced authoritative docs.
- Stop on unresolved material ambiguity and ask one bounded decision question.
- Stop after presenting the complete Inception proposal for human review.

## Runtime

Selected executor interface: Codex (`codex`).
Runtime selection changes who executes this handoff, never the method semantics.
