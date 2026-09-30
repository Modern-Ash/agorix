---
schema: "agora/tool-result/v1"
run: "ai-dlc-start-issue-87"
status: "completed"
exit-code: 0
result-kind: "work-item"
---

# Tool result ai-dlc-start-issue-87

## Standard output

    {"assignees":[],"body":"## Parent\n#66\n\n## Dependencies\n\n#85 and canonical program validator.\n\n## Objective\n\nCreate the domain protocol used whenever AI proposes a program change.\n\n## Protocol requirements\n\nA proposal must include:\n- schema/version;\n- proposal id;\n- base program version/hash;\n- capability/source metadata;\n- pedagogical purpose;\n- affected canonical node ids where known;\n- structured operations/patch;\n- child-facing rationale;\n- optional concept tags;\n- no executable arbitrary code payload as authority.\n\n## Supported initial operations\n\nDefine a bounded set such as:\n- insert node/subtree;\n- replace allowed field/value;\n- replace bounded subtree;\n- remove node;\n- reorder allowed nodes.\n\nExact operations must preserve canonical validation and stable ids where possible.\n\n## Application rules\n\n1. validate schema;\n2. verify base version/hash;\n3. validate operations against allowed program model;\n4. compute candidate canonical program;\n5. run canonical validator;\n6. produce deterministic diff;\n7. wait for learner decision;\n8. mutate canonical state only after acceptance.\n\n## Acceptance\n\n- [ ] stale proposal cannot apply to changed base;\n- [ ] unknown operation rejected;\n- [ ] resulting program must validate;\n- [ ] deterministic diff generated independently from model prose;\n- [ ] proposal can be serialized/audited without PII;\n- [ ] no provider SDK types leak into protocol;\n- [ ] tests cover insert/change/remove/stale/invalid;\n- [ ] integrates with UI boundary from #75.\n\n## Security\n\nNever evaluate provider-returned source code or functions.","createdAt":"2026-09-26T23:00:17Z","labels":[],"milestone":null,"number":87,"state":"OPEN","stateReason":"","title":"Define and implement structured ProgramProposal protocol for AI-generated changes","updatedAt":"2026-09-26T23:00:17Z","url":"https://github.com/Modern-Ash/agorix/issues/87"}

## Standard error

    (empty)
