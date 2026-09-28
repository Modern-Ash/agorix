---
schema: "agora/tool-result/v1"
run: "ai-dlc-start-issue-91"
status: "completed"
exit-code: 0
result-kind: "work-item"
---

# Tool result ai-dlc-start-issue-91

## Standard output

    {"assignees":[],"body":"## Parent\n#66\n\n## Dependencies\n\n#86 #87 #88 #89 #90 plus transparency work #75/#76.\n\n## Objective\n\nDeliver the first complete Agorix experience that proves AI is integrated into the learning method without replacing the learner.\n\n## Scenario\n\nUsing a deterministic fake companion by default:\n\n1. learner states a simple goal/intent;\n2. companion asks at most a bounded clarification/decomposition question;\n3. a simple child-readable plan is shown;\n4. companion proposes a structured program change;\n5. learner sees block/code impact;\n6. learner accepts or modifies;\n7. learner predicts what will happen;\n8. learner uses Step or Run;\n9. runtime produces deterministic evidence;\n10. an intentional/incomplete case is debugged from evidence;\n11. learner corrects the program;\n12. mission completes deterministically;\n13. learner answers a short reflection question.\n\n## Constraints\n\n- no external LLM required in CI;\n- no hidden mutation;\n- code visible throughout;\n- mission completion independent from model judgment;\n- provider unavailable path remains safe;\n- child-facing copy follows content guide.\n\n## Acceptance\n\n- [ ] full browser journey passes deterministically;\n- [ ] at least one learner decision is required before AI proposal application;\n- [ ] debugger cites/uses actual runtime facts;\n- [ ] Step/highlighting works in the flow;\n- [ ] reflection captures reasoning without gating completion;\n- [ ] test fails if AI can bypass acceptance;\n- [ ] artifacts/screenshots demonstrate the product differentiator.\n\n## Evidence\n\nPlaywright trace + demo recording/script + mapping from each interaction to pedagogical principles.\n\n## Primary execution surface\n\nThe primary E2E for this issue is **Agorix Web / Tablet**, because that is the first learning surface for the target learner.\n\nRequired product path:\n- touch-first action selection;\n- visible World + Code;\n- contextual Learning Companion;\n- proposal card;\n- learner decision;\n- Step/Run;\n- observable World change;\n- evidence-grounded debugging;\n- reflection.\n\nDesktop browser may also be covered, but cannot substitute for tablet validation.\n\n## Additional acceptance\n\n- [ ] full journey passes in tablet landscape;\n- [ ] critical journey passes in tablet portrait;\n- [ ] no permanent Scratch-style toolbox is required;\n- [ ] World + Code remain the dominant surfaces;\n- [ ] interaction survives orientation/viewport change.\n","createdAt":"2026-09-26T23:00:24Z","labels":[],"milestone":null,"number":91,"state":"OPEN","stateReason":"","title":"Create end-to-end AI-native learner loop for First Mission","updatedAt":"2026-09-27T01:31:05Z","url":"https://github.com/Modern-Ash/agorix/issues/91"}

## Standard error

    (empty)
