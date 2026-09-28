---
schema: "agora/tool-result/v1"
run: "ai-dlc-start-issue-78"
status: "completed"
exit-code: 0
result-kind: "work-item"
---

# Tool result ai-dlc-start-issue-78

## Standard output

    {"assignees":[],"body":"## Parent\n#64\n\n## Dependencies\n\n#75 #76 #77 and updated learner journey.\n\n## Objective\n\nCreate a browser-level test that proves the core transparency invariant end to end.\n\n## Scenario\n\n1. open a known starter project;\n2. verify blocks and textual code are visible;\n3. request or inject a deterministic AI proposal;\n4. verify canonical program has not changed;\n5. verify proposal diff/preview is visible;\n6. reject once and prove program remains unchanged;\n7. request/recreate proposal;\n8. accept it;\n9. verify blocks + code update from canonical state;\n10. use Step;\n11. verify current block and code range are highlighted;\n12. verify child-readable execution/state change;\n13. finish with Run;\n14. verify deterministic outcome.\n\n## Test constraints\n\n- deterministic fake provider;\n- no network/real LLM credential;\n- no arbitrary sleeps;\n- assert canonical/base hash where practical;\n- desktop + narrow viewport;\n- retain trace/screenshots on failure.\n\n## Acceptance\n\n- [ ] test fails if proposal auto-applies;\n- [ ] test fails if code is hidden during proposal/execution;\n- [ ] test fails if highlight cannot map through canonical node id;\n- [ ] test proves reject is side-effect free;\n- [ ] test proves accepted proposal executes deterministically;\n- [ ] stable in CI.\n\n## Evidence\n\nPlaywright trace and documented mapping to product invariants.\n\n## Tablet-first E2E requirements\n\nReplace the vague “narrow viewport” requirement with explicit product gates:\n\n- tablet landscape;\n- tablet portrait;\n- desktop Web.\n\nThe E2E should exercise touch-oriented interaction where supported:\n- open Action Palette;\n- add an action;\n- reorder or use accessible alternative;\n- inspect AI proposal;\n- reject/accept;\n- Step;\n- observe World + code;\n- rotate/change viewport and continue without state loss.\n\n## Additional acceptance\n\n- [ ] test fails if code becomes inaccessible on tablet;\n- [ ] tablet portrait and landscape are both covered;\n- [ ] orientation/viewport change preserves canonical state;\n- [ ] no hover/right-click dependency is required.\n","createdAt":"2026-09-26T22:58:39Z","labels":[],"milestone":null,"number":78,"state":"OPEN","stateReason":"","title":"Create E2E transparency journey proving no hidden mutation and observable execution","updatedAt":"2026-09-27T01:31:00Z","url":"https://github.com/Modern-Ash/agorix/issues/78"}

## Standard error

    (empty)
