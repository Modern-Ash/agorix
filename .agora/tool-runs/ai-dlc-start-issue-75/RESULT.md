---
schema: "agora/tool-result/v1"
run: "ai-dlc-start-issue-75"
status: "completed"
exit-code: 0
result-kind: "work-item"
---

# Tool result ai-dlc-start-issue-75

## Standard output

    {"assignees":[],"body":"## Parent\n#64\n\n## Dependencies\n\n#74 and the structured proposal contract from #87 when available.\n\n## Objective\n\nEnsure AI-originated program changes can never mutate canonical state invisibly.\n\n## Required behavior\n\n```text\nAI structured proposal\n      |\n      v\nvalidate proposal\n      |\n      v\nrender preview + explanation + diff\n      |\n      +--> reject -> no state change\n      |\n      +--> modify -> learner-edited proposal\n      |\n      +--> accept -> canonical mutation\n```\n\n## Scope\n\nImplement the application/domain boundary needed for:\n- proposal id/version;\n- proposed canonical patch/operation;\n- affected node ids;\n- child-facing rationale;\n- deterministic validation result;\n- preview representation;\n- explicit decision;\n- audit/event record with no PII.\n\n## UI requirements\n\nShow, at minimum:\n- what will be added/changed/removed;\n- corresponding block/code region;\n- Accept;\n- Change/Modify;\n- Reject.\n\nNo “Apply automatically” default.\n\n## Safety\n\n- provider output never directly mutates canonical state;\n- invalid proposals fail closed;\n- unsupported operations are rejected;\n- proposal processing observes program size/nesting limits;\n- no arbitrary generated JS execution.\n\n## Acceptance\n\n- [ ] proposal cannot mutate program before explicit acceptance;\n- [ ] reject preserves exact canonical hash/state;\n- [ ] accepted proposal passes canonical validator;\n- [ ] diff is derived from structured state, not only model prose;\n- [ ] affected code/block mapping can be highlighted;\n- [ ] malformed provider response is safely rejected;\n- [ ] tests cover accept/reject/modify/invalid/stale proposal;\n- [ ] stale proposal against changed base state cannot apply silently.\n\n## Evidence\n\nUnit tests + component/integration tests + screenshot/trace for the review flow.\n\n## Surface-specific presentation\n\nThe domain boundary remains shared, but presentation differs:\n\n### Web / Tablet\nRender a touch-friendly proposal card with:\n- concise rationale;\n- affected visual/code region;\n- Try/Accept;\n- Modify;\n- Reject/No usar.\n\n### Agorix Studio\nRender the same ProgramProposal as an IDE-friendly diff/preview where appropriate:\n- exact affected code;\n- Accept;\n- Edit;\n- Reject.\n\nNo surface may add a silent apply path.\n\n## Additional acceptance\n\n- [ ] same proposal fixture can render on Web and Studio;\n- [ ] accept/reject results produce identical canonical semantics;\n- [ ] tablet actions are touch accessible;\n- [ ] Studio diff does not become an independent source of truth.\n","createdAt":"2026-09-26T22:58:35Z","labels":[],"milestone":null,"number":75,"state":"OPEN","stateReason":"","title":"Implement structured AI proposal preview, diff and learner acceptance boundary","updatedAt":"2026-09-27T01:30:53Z","url":"https://github.com/Modern-Ash/agorix/issues/75"}

## Standard error

    (empty)
