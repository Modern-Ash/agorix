---
schema: "agora/tool-result/v1"
run: "ai-dlc-start-issue-73"
status: "completed"
exit-code: 0
result-kind: "work-item"
---

# Tool result ai-dlc-start-issue-73

## Standard output

    {"assignees":[],"body":"## Parent\n#63\n\n## Objective\n\nMake “open source” a repository fact rather than only a product intention.\n\n## Current observation\n\nThe repository currently does not expose a root `LICENSE` file.\n\n## Read first\n\n- README.md\n- AGENTS.md\n- organization conventions for Modern-Ash repositories if available\n- #63 #67\n\n## Decisions required\n\nRecord an explicit decision for:\n- license;\n- copyright holder/name;\n- contribution model;\n- governance/maintainer authority;\n- treatment of curriculum/prompts/policies under the chosen license;\n- third-party asset/model license compatibility.\n\n## Preferred direction\n\n**Apache License 2.0 is the preferred license for Agorix**, subject to the repository owner's final approval when this issue is implemented.\n\nRationale:\n- permissive use, modification and redistribution;\n- explicit patent grant;\n- good fit for community extensions, language packs and provider adapters;\n- suitable for educational, research and commercial reuse;\n- consistent with the open ecosystem direction of the broader Agora work.\n\nDo not claim that the repository is formally Apache-2.0 licensed until the root `LICENSE` file is committed.\n\nAlternative permissive licenses such as MIT may be considered only if a concrete reason emerges during the governance decision.\n\n## Deliverables\n\nAt minimum, once the decision is approved:\n- root `LICENSE`;\n- `CONTRIBUTING.md`;\n- concise governance/maintainer section or `GOVERNANCE.md`;\n- README license/contribution links;\n- dependency/asset licensing notes if required.\n\n## Requirements\n\n- no claim of an OSS license before the actual license file exists;\n- distinguish software license from external model licenses;\n- distinguish source availability from permission to redistribute a model;\n- contributions must follow Agora/PR/no-self-merge rules where applicable.\n\n## Acceptance\n\n- [ ] GitHub repository has an explicit recognized OSS license;\n- [ ] contributors know how to propose changes;\n- [ ] model/provider licenses are not conflated with Agorix source license;\n- [ ] no incompatible bundled asset/model license is introduced silently;\n- [ ] README accurately states project licensing.\n\n## Evidence\n\nRecord the license/governance decision in an ADR or equivalent durable decision artifact.","createdAt":"2026-09-26T22:57:57Z","labels":[],"milestone":null,"number":73,"state":"OPEN","stateReason":"","title":"Formalize Agorix open-source license, governance and contribution model","updatedAt":"2026-09-26T23:23:25Z","url":"https://github.com/Modern-Ash/agorix/issues/73"}

## Standard error

    (empty)
