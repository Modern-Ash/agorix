---
schema: "agora/tool-result/v1"
run: "ai-dlc-start-issue-71"
status: "completed"
exit-code: 0
result-kind: "work-item"
---

# Tool result ai-dlc-start-issue-71

## Standard output

    {"assignees":[],"body":"## Parent\n#63\n\n## Dependencies\n\n#69 and preferably #70.\n\n## Objective\n\nTurn the revised product/pedagogy into an executable MVP and delivery sequence.\n\n## Read first\n\n- docs/product/PRODUCT_INTENT.md\n- docs/product/PEDAGOGY.md\n- docs/product/LEARNER_JOURNEY.md\n- docs/product/MVP.md\n- docs/product/COMPETITIVE_PRINCIPLES.md\n- docs/delivery/IMPLEMENTATION_ORDER.md\n- #64 #65 #66 #67 #68\n\n## Deliverables\n\nUpdate:\n- `docs/product/MVP.md`\n- `docs/product/COMPETITIVE_PRINCIPLES.md`\n- `docs/delivery/IMPLEMENTATION_ORDER.md`\n- `docs/delivery/POC_PLAN.md` if required for consistency.\n\n## MVP must demonstrate\n\nA learner can:\n\n1. express a simple intent;\n2. work with blocks while textual code is always visible;\n3. receive at least one bounded AI proposal;\n4. see exactly what the proposal changes;\n5. accept/reject/modify it;\n6. run or step through the resulting program;\n7. observe deterministic execution;\n8. use AI to reason from runtime evidence if the behavior is wrong;\n9. correct the program;\n10. explain one programming concept or change.\n\nThe MVP must remain demonstrable with a local/open model configuration when hardware/environment permits.\n\n## Competitive framing\n\nDo not position Agorix as a clone.\n\nExplain the distinction among:\n- block-first creative environments;\n- block↔text environments;\n- coding tools with chat assistants;\n- Agorix's transparent AI-native learning loop.\n\n## Delivery ordering\n\nPrioritize product re-foundation and the AI-native vertical slice before broad platform expansion.\n\nExplicitly mark existing items such as Capacitor/VS Code proofs as deferred or dependent where appropriate rather than deleting them.\n\n## Acceptance\n\n- [ ] MVP exit criteria require genuine AI-native learner interaction;\n- [ ] MVP does not count a hidden AI-generated solution as success;\n- [ ] code visibility is invariant;\n- [ ] multi-language work has a staged delivery order;\n- [ ] local/open model support appears in roadmap;\n- [ ] old and new issues are mapped without contradictory execution order;\n- [ ] the implementation order can be followed by independent agents.\n\n## Evidence\n\nProvide a dependency diagram and a table mapping legacy issues to:\n- preserve;\n- extend;\n- supersede;\n- defer;\n- retire.\n\n## Backlog reconciliation input\n\nUse #106 as the temporary operational execution map. This issue must reconcile that map into `docs/delivery/IMPLEMENTATION_ORDER.md`, including preserved, superseded and deferred legacy work.","createdAt":"2026-09-26T22:57:53Z","labels":[],"milestone":null,"number":71,"state":"OPEN","stateReason":"","title":"Revise MVP, competitive principles and implementation order around the AI-native north star","updatedAt":"2026-09-26T23:10:15Z","url":"https://github.com/Modern-Ash/agorix/issues/71"}

## Standard error

    (empty)
