---
schema: "agora-ai-sdlc/artifact/v1"
kind: "domain-model"
version: 1
id: "DM-069"
work: "issue-69"
revision: 1
traces-to: ["INT-069", "REQ-069"]
---

# Domain Model

## Core concepts

- Learner: the child authoring the program.
- Learning companion: AI-supported scaffold that asks, proposes, explains and challenges, but does not own the program.
- Proposal: an AI-originated suggestion that is not program state until learner decision.
- Accepted program: learner-controlled canonical program state.
- Executed result: deterministic runtime behavior produced from the accepted program.
- Runtime evidence: observed facts from deterministic execution.
- Reflection: learner explanation after behavior is observed.

## Invariants

AI proposes, the child decides, the runtime proves and the child explains. No AI-originated program mutation is hidden. Runtime evidence outranks model claims.
