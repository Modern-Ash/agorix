---
schema: "agora/tool-result/v1"
run: "ai-dlc-start-issue-103"
status: "completed"
exit-code: 0
result-kind: "work-item"
---

# Tool result ai-dlc-start-issue-103

## Standard output

    {"assignees":[],"body":"## Parent\n#68\n\n## Dependencies\n\n#92 provider contract and existing child-safety docs.\n\n## Objective\n\nUpdate the security/privacy model for an AI-native product that may run either entirely locally or through remote providers.\n\n## Threat/data-flow model\n\nCover:\n- browser/app;\n- tutor/learning-companion API;\n- local provider;\n- remote provider;\n- canonical program;\n- runtime observations;\n- learner free text;\n- logs/telemetry;\n- proposal history;\n- persistence.\n\n## Required decisions\n\nFor each data class define:\n- is it needed?\n- where is it processed?\n- is it persisted?\n- is it logged?\n- can it leave the device?\n- how is it minimized/sanitized?\n\n## Requirements\n\n- no name, school, exact location or contact data required;\n- raw child free text not logged by default;\n- local-only mode makes network expectations explicit;\n- remote mode sends only capability-required context;\n- secrets never enter client bundle;\n- model/provider telemetry implications documented where knowable;\n- no silent analytics expansion.\n\n## Acceptance\n\n- [ ] data-flow diagram exists for local and remote modes;\n- [ ] every outbound field has justification;\n- [ ] logs have explicit allowlist/denylist guidance;\n- [ ] threat model covers prompt injection/malformed provider output at appropriate level;\n- [ ] child safety doc updated consistently;\n- [ ] deviations require explicit review.\n\n## Evidence\n\nSecurity/privacy review checklist and testable controls mapped to implementation issues.","createdAt":"2026-09-26T23:02:28Z","labels":[],"milestone":null,"number":103,"state":"OPEN","stateReason":"","title":"Create privacy and data-minimization threat model for local and remote AI modes","updatedAt":"2026-09-26T23:02:28Z","url":"https://github.com/Modern-Ash/agorix/issues/103"}

## Standard error

    (empty)
