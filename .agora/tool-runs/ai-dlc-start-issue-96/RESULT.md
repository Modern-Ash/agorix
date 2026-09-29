---
schema: "agora/tool-result/v1"
run: "ai-dlc-start-issue-96"
status: "completed"
exit-code: 0
result-kind: "work-item"
---

# Tool result ai-dlc-start-issue-96

## Standard output

    {"assignees":[],"body":"## Parent\n#67\n\n## Dependencies\n\n#92 and at least one local adapter (#93 or #94).\n\n## Objective\n\nSelect providers by required pedagogical capability while keeping Agorix usable when no LLM is available.\n\n## Requirements\n\nConfiguration may define:\n- preferred provider/runtime;\n- model;\n- ordered fallbacks;\n- allowed remote/local providers;\n- offline mode.\n\nSelection must consider required capability, not just provider name.\n\n## Offline/degraded behavior\n\nWhen no model is available:\n- deterministic runtime remains fully functional;\n- blocks/code/language projections remain functional;\n- deterministic hints/mission feedback remain available where implemented;\n- AI-only controls communicate unavailability clearly;\n- no mission state corruption;\n- no fake claim that AI responded.\n\n## Acceptance\n\n- [ ] capability-aware selection tested;\n- [ ] preferred provider unavailable -> documented fallback;\n- [ ] no compatible provider -> clear unavailable state;\n- [ ] offline mode does not call network;\n- [ ] canonical/runtime behavior unchanged;\n- [ ] child-facing copy avoids technical provider jargon by default;\n- [ ] developer diagnostics expose selected runtime/model safely.\n\n## Evidence\n\nTable-driven selection tests + browser offline scenario.","createdAt":"2026-09-26T23:01:14Z","labels":[],"milestone":null,"number":96,"state":"OPEN","stateReason":"","title":"Implement provider selection, capability fallback and meaningful offline mode","updatedAt":"2026-09-26T23:01:14Z","url":"https://github.com/Modern-Ash/agorix/issues/96"}

## Standard error

    (empty)
