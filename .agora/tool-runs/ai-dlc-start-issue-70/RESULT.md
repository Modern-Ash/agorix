---
schema: "agora/tool-result/v1"
run: "ai-dlc-start-issue-70"
status: "completed"
exit-code: 0
result-kind: "work-item"
---

# Tool result ai-dlc-start-issue-70

## Standard output

    {"assignees":[],"body":"## Parent\n#63\n\n## Objective\n\nDefine a pedagogical progression that describes what a learner should understand and do as Agorix gradually moves from blocks to text and from guided AI interaction to greater autonomy.\n\n## Read first\n\n- docs/product/PEDAGOGY.md after #69\n- docs/product/PRODUCT_INTENT.md\n- docs/product/LEARNER_JOURNEY.md\n- docs/architecture/PROGRAMMING_MODEL.md\n- #63\n\n## Deliverable\n\nCreate:\n- `docs/product/LEARNING_PROGRESSION.md`\n\n## Required dimensions\n\nThe progression must cover at least:\n\n### Programming\n- sequence;\n- events;\n- repetition;\n- conditions;\n- state/variables;\n- decomposition/functions;\n- debugging;\n- reading code;\n- modifying textual code later in the roadmap.\n\n### Human-AI collaboration\n- expressing intent;\n- answering clarifying questions;\n- inspecting AI proposals;\n- accepting/rejecting/modifying proposals;\n- predicting behavior;\n- testing proposals;\n- challenging an AI answer;\n- comparing alternatives;\n- explaining a decision.\n\n### AI literacy\n- AI can be wrong;\n- fluent language is not proof;\n- runtime/test evidence matters;\n- models can disagree;\n- private data is unnecessary for programming tasks;\n- learner remains author/decision maker.\n\n## Progression model\n\nDefine stages without hard-coding age as a technical gate. Suggested conceptual stages:\n\n1. **Explore** — blocks + Agorix Code; AI asks simple questions.\n2. **Connect** — blocks + textual correspondence; learner predicts.\n3. **Translate** — Agorix Code ↔ Python; learner compares forms.\n4. **Collaborate** — learner evaluates bounded AI proposals.\n5. **Create** — textual code + AI assistance with stronger autonomy.\n6. **Critique** — compare alternatives/models and justify choices.\n\nYou may rename/restructure these if evidence supports a better model.\n\n## Scaffolding rubric\n\nFor each stage define:\n- what AI may do;\n- what AI should avoid doing;\n- expected learner action;\n- observable evidence of understanding;\n- when to escalate/de-escalate help;\n- what counts as over-assistance.\n\n## Acceptance\n\n- [ ] progression is concept-based, not merely age-based;\n- [ ] every stage has observable learner behavior;\n- [ ] AI responsibility decreases as learner autonomy increases;\n- [ ] progression covers programming and AI literacy;\n- [ ] rubric can later drive curriculum metadata and tests;\n- [ ] no dependence on a specific provider/model;\n- [ ] no “prompt engineering course” framing.\n\n## Evidence\n\nIndependent pedagogical review must challenge at least:\n- whether the progression hides code;\n- whether AI can complete work before the learner reasons;\n- whether understanding can be observed.","createdAt":"2026-09-26T22:57:52Z","labels":[],"milestone":null,"number":70,"state":"OPEN","stateReason":"","title":"Define learner competency progression and adaptive scaffolding rubric","updatedAt":"2026-09-26T22:57:52Z","url":"https://github.com/Modern-Ash/agorix/issues/70"}

## Standard error

    (empty)
