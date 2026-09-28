---
schema: "agora/work/v1"
id: "web-security-baseline"
swarm: "issue-30"
title: "POC child-safety and web-security baseline (issue #30)"
state: "implementing"
revision: 1
operational-status: "active"
status-reason: null
status-by: null
status-at: null
acceptance-criteria: {"secret-scan":"Automated checks/search catch accidental secret fixture patterns","runtime-allowlist":"Runtime operation allowlist documented and tested","no-client-secrets":"Client/browser bundles contain no provider secrets","no-generated-code":"Arbitrary provider/generated source is never executed","security-checklist":"Security review checklist committed","adr-deviations":"Deviations require explicit ADR/issue","cross-links":"Links to #100/#103 are reflected in security docs"}
satisfied-criteria: []
criterion-statuses: {"secret-scan":[],"runtime-allowlist":[],"no-client-secrets":[],"no-generated-code":[],"security-checklist":[],"adr-deviations":[],"cross-links":[]}
required-artifacts: []
child-work-refs: []
budget-limits: null
---

# POC child-safety and web-security baseline (issue #30)

## Description

Turn documented baseline safety/security constraints into enforceable controls for the core application. Scope: no POC account/PII domain fields, no public sharing/chat/DM, no precise location requirement, CSP/security headers where deployed, dependency/security scanning, no eval/Function/arbitrary generated-code execution, runtime operation allowlist, external link restrictions, curated bundled starter assets, secret fixture/static checks. AI-specific validation split off to #100/#103.

## Acceptance criteria

- [ ] **secret-scan:** Automated checks/search catch accidental secret fixture patterns; stages: none
- [ ] **runtime-allowlist:** Runtime operation allowlist documented and tested; stages: none
- [ ] **no-client-secrets:** Client/browser bundles contain no provider secrets; stages: none
- [ ] **no-generated-code:** Arbitrary provider/generated source is never executed; stages: none
- [ ] **security-checklist:** Security review checklist committed; stages: none
- [ ] **adr-deviations:** Deviations require explicit ADR/issue; stages: none
- [ ] **cross-links:** Links to #100/#103 are reflected in security docs; stages: none

## Required artifacts

- none
