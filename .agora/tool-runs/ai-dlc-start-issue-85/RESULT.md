---
schema: "agora/tool-result/v1"
run: "ai-dlc-start-issue-85"
status: "completed"
exit-code: 0
result-kind: "work-item"
---

# Tool result ai-dlc-start-issue-85

## Standard output

    {"assignees":[],"body":"## Parent\n#66\n\n## Objective\n\nReplace the narrow tutor-only domain contract with a **LearningCompanion** capability model that supports pedagogical roles without binding the domain to a provider or to separate agents.\n\n## Read first\n\n- packages/tutor-contract\n- docs/architecture/AI_TUTOR.md\n- docs/product/PEDAGOGY.md after #69\n- #66\n\n## Required capabilities\n\nModel requests/responses for at least:\n- coach/question;\n- bounded builder proposal;\n- evidence-grounded debugger;\n- explainer;\n- challenger/prediction;\n- reflector.\n\nThese may share a common envelope with capability-specific payloads.\n\n## Required context\n\nUse only the minimum needed:\n- mission/version;\n- learning objective;\n- sanitized canonical program;\n- selected/active node ids;\n- deterministic runtime observations when relevant;\n- hint/scaffolding history;\n- learner question/intent;\n- locale/reading configuration if present.\n\n## Rules\n\n- no provider-specific fields in domain contract;\n- structured output validation;\n- builder capability may only return a structured proposal, never directly mutate program;\n- debugger may not assert runtime facts absent from evidence;\n- response includes capability identity and pedagogical/scaffolding metadata;\n- maintain backward migration path from existing tutor fake/contract.\n\n## Deliverables\n\n- contract/types/schema;\n- architecture/migration note;\n- deterministic fake implementation for all required capabilities or explicit staged subset;\n- reusable conformance tests.\n\n## Acceptance\n\n- [ ] existing hint behavior can migrate without provider coupling;\n- [ ] builder output cannot be confused with accepted canonical state;\n- [ ] debugger context distinguishes facts from model suggestions;\n- [ ] malformed responses fail closed;\n- [ ] contract supports local and remote providers equally;\n- [ ] no child PII required;\n- [ ] package has no provider SDK dependency.\n\n## Evidence\n\nContract tests + migration compatibility tests.","createdAt":"2026-09-26T23:00:13Z","labels":[],"milestone":null,"number":85,"state":"OPEN","stateReason":"","title":"Evolve tutor-contract into a provider-neutral LearningCompanion capability contract","updatedAt":"2026-09-26T23:00:13Z","url":"https://github.com/Modern-Ash/agorix/issues/85"}

## Standard error

    (empty)
