---
schema: "agora/work/v1"
id: "text-projection"
swarm: "text-projection"
title: "Issue #16: Implement canonical program to continuously visible text projection"
state: "completed"
revision: 1
operational-status: "active"
status-reason: null
status-by: null
status-at: null
acceptance-criteria: {"stable-snapshots":"Stable snapshots for all operations","node-text-mapping":"Node to text mapping available for UI highlighting","deterministic":"Same program always gives same output","panel-refresh":"Generated code panel can refresh on every meaningful block edit","latency":"Projection latency suitable for interactive editing","all-ops":"Every POC operation supported with fixture coverage","unsupported-error":"Explicit unsupported-node error"}
satisfied-criteria: ["stable-snapshots","node-text-mapping","deterministic","panel-refresh","latency","all-ops","unsupported-error"]
criterion-statuses: {"stable-snapshots":["elaborated","designed","built","verified","deployed","accepted"],"node-text-mapping":["elaborated","designed","built","verified","deployed","accepted"],"deterministic":["elaborated","designed","built","verified","deployed","accepted"],"panel-refresh":["elaborated","designed","built","verified","deployed","accepted"],"latency":["elaborated","designed","built","verified","deployed","accepted"],"all-ops":["elaborated","designed","built","verified","deployed","accepted"],"unsupported-error":["elaborated","designed","built","verified","deployed","accepted"]}
required-artifacts: ["domain-model","architecture","implementation-plan","test-strategy"]
child-work-refs: []
budget-limits: null
---

# Issue #16: Implement canonical program to continuously visible text projection

## Description

Provide the textual learning surface displayed beside blocks at all times. Readable TypeScript/JavaScript-like educational code generated solely from canonical program state. Requirements: deterministic formatting; canonical node to text-range mapping; every POC operation supported; no side effects; explicit unsupported-node error; generated text read-only in POC; never executed by runtime. Acceptance: stable snapshots; node to text mapping for UI highlighting; same program same output; panel refresh on every meaningful block edit; projection latency suitable for interactive editing. Tests: fixtures for all operations and nested structures. Read docs/architecture/PROGRAMMING_MODEL.md. Output: packages/code-generator.

## Acceptance criteria

- [x] **stable-snapshots:** Stable snapshots for all operations; stages: elaborated, designed, built, verified, deployed, accepted
- [x] **node-text-mapping:** Node to text mapping available for UI highlighting; stages: elaborated, designed, built, verified, deployed, accepted
- [x] **deterministic:** Same program always gives same output; stages: elaborated, designed, built, verified, deployed, accepted
- [x] **panel-refresh:** Generated code panel can refresh on every meaningful block edit; stages: elaborated, designed, built, verified, deployed, accepted
- [x] **latency:** Projection latency suitable for interactive editing; stages: elaborated, designed, built, verified, deployed, accepted
- [x] **all-ops:** Every POC operation supported with fixture coverage; stages: elaborated, designed, built, verified, deployed, accepted
- [x] **unsupported-error:** Explicit unsupported-node error; stages: elaborated, designed, built, verified, deployed, accepted

## Required artifacts

- domain-model
- architecture
- implementation-plan
- test-strategy
