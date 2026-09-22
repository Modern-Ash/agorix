---
schema: "agora/swarm/v1"
id: "ci"
method: "ai-sdlc"
status: "ready"
branch: "feat/issue-29-ci"
required-roles: ["product-owner", "developer"]
assignments: { "product-owner": "project:product-owner", "developer": "project:ai-runtime-2" }
---

# Swarm ci

## Objective

Add repository CI for lint, typecheck, unit, build and browser smoke (issue #29)

## Assignments

| Role          | Actor                 |
| ------------- | --------------------- |
| product-owner | project:product-owner |
| developer     | project:ai-runtime-2  |
