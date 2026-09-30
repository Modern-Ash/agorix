---
schema: "agora/tool-result/v1"
run: "ai-dlc-start-issue-86"
status: "completed"
exit-code: 0
result-kind: "work-item"
---

# Tool result ai-dlc-start-issue-86

## Standard output

    {"assignees":[],"body":"## Parent\n#66\n\n## Dependencies\n\n#85 and updated learner journey.\n\n## Objective\n\nTeach the learner to express and decompose intent before AI proposes code/program structure.\n\n## Example\n\nLearner:\n> I want the robot to reach the planet.\n\nAgorix should not immediately generate a solution.\n\nIt may ask:\n- What should happen first?\n- Does the robot need to repeat a move?\n- How will we know it reached the planet?\n\n## Scope\n\nImplement a bounded dialogue state for:\n- learner intent;\n- clarifying/decomposition question;\n- learner answer;\n- simple plan;\n- explicit transition from plan to program proposal.\n\n## Pedagogical rules\n\n- prefer one useful question at a time for beginners;\n- avoid interrogating when intent is already clear;\n- do not expose chain-of-thought;\n- plan language should be child-readable;\n- learner can revise intent/plan;\n- plan is not executable authority.\n\n## Acceptance\n\n- [ ] clear intent can progress without unnecessary questions;\n- [ ] ambiguous intent triggers a pedagogically useful clarification;\n- [ ] no canonical mutation occurs during planning;\n- [ ] plan references learning objective/concepts where relevant;\n- [ ] learner can edit/reject plan;\n- [ ] deterministic fake companion supports test scenarios;\n- [ ] UI works without real provider credentials.\n\n## Evidence\n\nState-machine/unit tests plus component test for one clear and one ambiguous intent.","createdAt":"2026-09-26T23:00:14Z","labels":[],"milestone":null,"number":86,"state":"OPEN","stateReason":"","title":"Implement intent-to-plan learning dialogue before program generation","updatedAt":"2026-09-26T23:00:14Z","url":"https://github.com/Modern-Ash/agorix/issues/86"}

## Standard error

    (empty)
