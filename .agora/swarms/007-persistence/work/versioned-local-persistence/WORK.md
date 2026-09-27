---
schema: "agora/work/v1"
id: "versioned-local-persistence"
swarm: "persistence"
title: "Issue #28: versioned local project persistence and migrations boundary"
state: "inception"
revision: 1
operational-status: "active"
status-reason: null
status-by: null
status-at: null
acceptance-criteria: {"reload":"reload restores project semantics","generated-code":"generated code is regenerated from canonical state","safe-failure":"unknown future version fails safely","no-react":"persistence package has no React dependency","no-pii":"no child PII required","tests":"unit tests plus integration test with editor state"}
satisfied-criteria: ["reload"]
criterion-statuses: {"reload":["elaborated","designed","built","verified","deployed","accepted"],"generated-code":["elaborated"],"safe-failure":["elaborated"],"no-react":["elaborated"],"no-pii":["elaborated"],"tests":["elaborated"]}
required-artifacts: ["domain-model","architecture","implementation-plan","test-strategy"]
child-work-refs: []
budget-limits: null
---

# Issue #28: versioned local project persistence and migrations boundary

## Description

Persist POC learner projects locally without accounts. Browser-local storage abstraction, project schema/version, canonical program as the only source of truth, stage/project state for reload, mission progress/hint level, explicit migration strategy, corruption-safe failure, no generated code persisted as independent authority.

## Acceptance criteria

- [x] **reload:** reload restores project semantics; stages: elaborated, designed, built, verified, deployed, accepted
- [ ] **generated-code:** generated code is regenerated from canonical state; stages: elaborated
- [ ] **safe-failure:** unknown future version fails safely; stages: elaborated
- [ ] **no-react:** persistence package has no React dependency; stages: elaborated
- [ ] **no-pii:** no child PII required; stages: elaborated
- [ ] **tests:** unit tests plus integration test with editor state; stages: elaborated

## Required artifacts

- domain-model
- architecture
- implementation-plan
- test-strategy
