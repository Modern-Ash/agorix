---
schema: "agora/tool-result/v1"
run: "ai-dlc-start-issue-76"
status: "completed"
exit-code: 0
result-kind: "work-item"
---

# Tool result ai-dlc-start-issue-76

## Standard output

    {"assignees":[],"body":"## Parent\n#64\n\n## Dependencies\n\nExisting canonical interpreter (#14), observations (#15), node↔text mapping (#16), editor (#20), and UX contract #74.\n\n## Objective\n\nLet the learner execute the program one meaningful instruction at a time and see the exact block and textual code responsible for the behavior.\n\n## Required semantics\n\n- `Step` advances one pedagogically meaningful runtime event/instruction;\n- current canonical node id is explicit;\n- corresponding block is highlighted;\n- corresponding textual code range is highlighted;\n- stage update occurs after/beside the highlighted instruction according to documented timing;\n- repeated Step calls remain deterministic;\n- Stop/Reset semantics remain exact.\n\n## Loop/condition behavior\n\nDefine and test how Step exposes:\n- entering repeat;\n- each repeated body instruction;\n- condition evaluation;\n- branch taken/not taken;\n- completion.\n\nAvoid implementation details that make a single Step meaningless to a child.\n\n## UI\n\nAdd `Step` beside Run/Stop/Reset where appropriate and keep it keyboard/touch accessible.\n\n## Acceptance\n\n- [ ] same canonical program gives same Step sequence;\n- [ ] block and active language projection highlight same canonical node;\n- [ ] Step cannot race with Run;\n- [ ] editing while stepped/executing follows defined stop semantics;\n- [ ] Reset restores exact initial state and Step cursor;\n- [ ] loops/conditions have documented child-understandable stepping;\n- [ ] tests cover simple, repeat and conditional programs;\n- [ ] narrow layout remains usable.\n\n## Evidence\n\nUnit runtime tests plus Playwright/component evidence showing synchronized highlight + stage update.\n\n## Surface presentation\n\n### Tablet/Web\nStep should make causality immediately visible:\n- highlight current code/visual instruction;\n- animate World result;\n- show a compact before/after state bubble when useful.\n\n### Agorix Studio\nStep should feed an educational debugger-like Execution Inspector:\n- current instruction;\n- iteration;\n- before/after state;\n- synchronized World Preview.\n\n## Additional acceptance\n\n- [ ] tablet touch Step is first-class;\n- [ ] Studio and Web produce the same canonical step sequence;\n- [ ] viewport/orientation changes do not lose step state;\n- [ ] presentation may differ but observations remain identical.\n","createdAt":"2026-09-26T22:58:36Z","labels":[],"milestone":null,"number":76,"state":"OPEN","stateReason":"","title":"Add Step execution with synchronized block and code highlighting","updatedAt":"2026-09-27T01:30:55Z","url":"https://github.com/Modern-Ash/agorix/issues/76"}

## Standard error

    (empty)
