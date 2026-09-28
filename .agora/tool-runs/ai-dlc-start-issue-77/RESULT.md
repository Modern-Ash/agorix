---
schema: "agora/tool-result/v1"
run: "ai-dlc-start-issue-77"
status: "completed"
exit-code: 0
result-kind: "work-item"
---

# Tool result ai-dlc-start-issue-77

## Standard output

    {"assignees":[],"body":"## Parent\n#64\n\n## Dependencies\n\n#76 and existing runtime observations.\n\n## Objective\n\nMake execution causality inspectable without exposing raw developer logs.\n\n## Required experience\n\nFor a simple instruction, the learner should be able to understand:\n\n```text\nmove 10\nbefore: x = 20\nafter:  x = 30\nresult: character moved right\n```\n\nUse age-appropriate presentation and progressively disclose detail.\n\n## Scope\n\nDefine/implement a presentation layer over deterministic observations:\n- instruction/node;\n- iteration where relevant;\n- condition result;\n- relevant state before/after;\n- visible effect;\n- stop/error/budget outcome.\n\n## Requirements\n\n- raw runtime trace remains separate from child-facing trace;\n- no LLM is required to produce objective trace facts;\n- optional AI explanation may consume the trace later;\n- do not expose internal stack traces or irrelevant engine state;\n- support collapsible/simplified presentation for beginners;\n- preserve accessibility.\n\n## Acceptance\n\n- [ ] trace derives solely from deterministic runtime facts;\n- [ ] state transitions are accurate;\n- [ ] learner can correlate trace item to highlighted block/code;\n- [ ] repeat iterations are understandable and not spammy;\n- [ ] condition result is visible in a child-appropriate form;\n- [ ] no PII or provider data enters trace;\n- [ ] tests prove ordering and before/after values.\n\n## Evidence\n\nFixtures for movement, repeat, condition, stop/reset and execution-budget path.\n\n## Progressive presentation profiles\n\nDefine at least two presentation profiles over the same deterministic observations:\n\n### Beginner / Tablet\nExample:\n```text\nNova moved right\nx: 20 -> 30\n```\n\n### Advanced / Studio\nExample:\n```text\nnode: move-3\niteration: 2/4\nbefore: x=20 y=0 heading=0\nafter:  x=30 y=0 heading=0\n```\n\nThe profiles are presentation only; the runtime trace remains canonical.\n\n## Additional acceptance\n\n- [ ] beginner trace avoids irrelevant engine detail;\n- [ ] Studio inspector can expose richer state;\n- [ ] both views correlate to the same canonical node;\n- [ ] trace rendering is localizable via #110.\n","createdAt":"2026-09-26T22:58:38Z","labels":[],"milestone":null,"number":77,"state":"OPEN","stateReason":"","title":"Add child-readable execution trace and state-change visualization","updatedAt":"2026-09-27T01:30:57Z","url":"https://github.com/Modern-Ash/agorix/issues/77"}

## Standard error

    (empty)
