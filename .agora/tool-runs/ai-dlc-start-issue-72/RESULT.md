---
schema: "agora/tool-result/v1"
run: "ai-dlc-start-issue-72"
status: "completed"
exit-code: 0
result-kind: "work-item"
---

# Tool result ai-dlc-start-issue-72

## Standard output

    {"assignees":[],"body":"## Parent\n#63\n\n## Dependencies\n\n#69 and #71.\n\n## Objective\n\nUpdate repository execution contracts so every human or AI developer is prevented from reintroducing the old “hidden assistant” model.\n\n## Read first\n\n- AGENTS.md\n- docs/architecture/SYSTEM_DESIGN.md\n- docs/architecture/AI_TUTOR.md\n- docs/architecture/PROGRAMMING_MODEL.md\n- updated product docs from #69/#71\n- #64 #65 #66 #67 #68\n\n## Deliverables\n\nUpdate:\n- `AGENTS.md`\n- `docs/architecture/SYSTEM_DESIGN.md`\n- replace, rename or explicitly supersede `docs/architecture/AI_TUTOR.md` with a learning-companion architecture document.\n\n## Mandatory product invariants\n\nEncode at minimum:\n\n- AI proposes; learner decides;\n- runtime proves;\n- learner explains;\n- code is continuously visible;\n- no invisible AI program mutations;\n- canonical program remains authority;\n- all language views derive from canonical state;\n- provider identity never leaks into domain contracts;\n- deterministic execution facts ground AI debugging/explanation;\n- child privacy/safety overrides engagement;\n- open-source-first/local-first where practical.\n\n## Mandatory architecture boundaries\n\nClarify:\n- program proposal boundary;\n- proposal validation;\n- learner acceptance boundary;\n- canonical state mutation point;\n- LanguageProjection boundary;\n- learning-companion contract;\n- provider adapter boundary;\n- runtime evidence interface.\n\n## Acceptance\n\n- [ ] an agent reading AGENTS.md cannot reasonably implement silent AI code edits;\n- [ ] domain packages remain provider/UI independent;\n- [ ] old tutor terminology is either deliberately retained for a narrow capability or superseded clearly;\n- [ ] architecture diagram shows AI proposal path separately from runtime execution;\n- [ ] no generated provider code is executed directly;\n- [ ] repository remains buildable without credentials.\n\n## Evidence\n\nArchitecture review by a different agent/provider or human is required.","createdAt":"2026-09-26T22:57:55Z","labels":[],"milestone":null,"number":72,"state":"OPEN","stateReason":"","title":"Update AGENTS and architecture invariants for transparent AI-native learning","updatedAt":"2026-09-26T22:57:55Z","url":"https://github.com/Modern-Ash/agorix/issues/72"}

## Standard error

    (empty)
