---
schema: "agora/work/v1"
id: "web-security-baseline"
swarm: "issue-30"
title: "POC child-safety and web-security baseline (issue #30)"
state: "completed"
revision: 1
operational-status: "active"
status-reason: null
status-by: null
status-at: null
acceptance-criteria: {"secret-scan":"Automated checks/search catch accidental secret fixture patterns","runtime-allowlist":"Runtime operation allowlist documented and tested","no-client-secrets":"Client/browser bundles contain no provider secrets","no-generated-code":"Arbitrary provider/generated source is never executed","security-checklist":"Security review checklist committed","adr-deviations":"Deviations require explicit ADR/issue","cross-links":"Links to #100/#103 are reflected in security docs"}
satisfied-criteria: ["secret-scan","runtime-allowlist","no-client-secrets","no-generated-code","security-checklist","adr-deviations","cross-links"]
criterion-statuses: {"secret-scan":["specified","implemented","verified","accepted"],"runtime-allowlist":["specified","implemented","verified","accepted"],"no-client-secrets":["specified","implemented","verified","accepted"],"no-generated-code":["specified","implemented","verified","accepted"],"security-checklist":["specified","implemented","verified","accepted"],"adr-deviations":["specified","implemented","verified","accepted"],"cross-links":["specified","implemented","verified","accepted"]}
required-artifacts: []
child-work-refs: []
budget-limits: null
---

# POC child-safety and web-security baseline (issue #30)

## Description

Turn documented baseline safety/security constraints into enforceable controls for the core application. Scope: no POC account/PII domain fields, no public sharing/chat/DM, no precise location requirement, CSP/security headers where deployed, dependency/security scanning, no eval/Function/arbitrary generated-code execution, runtime operation allowlist, external link restrictions, curated bundled starter assets, secret fixture/static checks. AI-specific validation split off to #100/#103.

## Acceptance criteria

- [x] **secret-scan:** Automated checks/search catch accidental secret fixture patterns; stages: specified, implemented, verified, accepted
- [x] **runtime-allowlist:** Runtime operation allowlist documented and tested; stages: specified, implemented, verified, accepted
- [x] **no-client-secrets:** Client/browser bundles contain no provider secrets; stages: specified, implemented, verified, accepted
- [x] **no-generated-code:** Arbitrary provider/generated source is never executed; stages: specified, implemented, verified, accepted
- [x] **security-checklist:** Security review checklist committed; stages: specified, implemented, verified, accepted
- [x] **adr-deviations:** Deviations require explicit ADR/issue; stages: specified, implemented, verified, accepted
- [x] **cross-links:** Links to #100/#103 are reflected in security docs; stages: specified, implemented, verified, accepted

## Required artifacts

- none
