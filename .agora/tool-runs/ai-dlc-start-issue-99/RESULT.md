---
schema: "agora/tool-result/v1"
run: "ai-dlc-start-issue-99"
status: "completed"
exit-code: 0
result-kind: "work-item"
---

# Tool result ai-dlc-start-issue-99

## Standard output

    {"assignees":[],"body":"## Parent\n#68\n\n## Objective\n\nMake it obvious to the learner when content comes from AI, when it is only a suggestion, and when execution has actually verified behavior.\n\n## Read first\n\n- updated CONTENT_GUIDE.md\n- transparent UX contract #74\n- LearningCompanion contract #85\n- #68\n\n## Required distinctions\n\nThe UI must visually/textually distinguish:\n- learner-authored content;\n- AI proposal/suggestion;\n- accepted program state;\n- runtime-observed fact;\n- explanatory interpretation.\n\n## Child-facing principles\n\n- avoid anthropomorphizing the model as a trusted person;\n- clearly communicate that suggestions can be wrong;\n- avoid technical provider/model jargon by default;\n- allow advanced/developer diagnostics separately;\n- do not use alarming warnings for routine uncertainty;\n- keep wording concise and age appropriate.\n\n## Deliverables\n\n- product/content spec;\n- reusable UI state/token design;\n- copy examples in supported locale(s);\n- accessibility guidance.\n\n## Acceptance\n\n- [ ] learner can tell whether a change is proposed vs already applied;\n- [ ] learner can tell whether a statement is runtime evidence vs AI suggestion;\n- [ ] “AI may be wrong” is communicated without excessive friction;\n- [ ] status does not rely on color alone;\n- [ ] screen-reader labels preserve distinction;\n- [ ] provider identity is optional developer detail, not child-facing authority.\n\n## Evidence\n\nComponent snapshots/tests covering proposal, accepted, runtime fact and unavailable states.\n\n## Surface-specific provenance UX\n\n### Web / Tablet\nKeep provenance simple and child-facing:\n- “Agorix propone” / “AI suggestion”;\n- clear distinction between suggestion, accepted program and runtime fact;\n- no provider/model jargon by default.\n\n### Agorix Studio\nAllow progressive disclosure of technical diagnostics for advanced learners/developers, such as local/remote provider or model, without presenting vendor identity as authority.\n\n## Additional acceptance\n\n- [ ] tablet proposal state is understandable without technical terminology;\n- [ ] Studio can expose optional details;\n- [ ] both surfaces preserve the same suggestion-vs-fact distinction.\n","createdAt":"2026-09-26T23:01:58Z","labels":[],"milestone":null,"number":99,"state":"OPEN","stateReason":"","title":"Design child-facing AI provenance, uncertainty and suggestion-state UX","updatedAt":"2026-09-27T01:31:08Z","url":"https://github.com/Modern-Ash/agorix/issues/99"}

## Standard error

    (empty)
