---
schema: "agora/tool-result/v1"
run: "ai-dlc-start-issue-119"
status: "completed"
exit-code: 0
result-kind: "work-item"
---

# Tool result ai-dlc-start-issue-119

## Standard output

    {"assignees":[],"body":"## Parent\n#116\n\n## Objective\n\nDefine **Agorix Worlds** as the shared narrative/visual layer that motivates learning without owning programming semantics.\n\n## Product model\n\nExamples:\n\n- Space — movement, loops, coordinates;\n- Ocean — conditions, events;\n- Robots — variables/functions;\n- City — state/events/concurrency concepts later.\n\nWorld themes are content. They do not fork runtime or canonical program semantics.\n\n## Deliverables\n\nCreate:\n- `docs/product/WORLDS.md`;\n- world/theme contract;\n- asset/theme boundary;\n- mission-to-world association;\n- progression rules;\n- starter world specification.\n\n## Required separation\n\n```text\nWorld\n  visuals\n  narrative\n  characters\n  mission framing\n        |\n        v\nMission contract\n        |\n        v\nCanonical Program + Runtime\n```\n\nNo world-specific runtime logic unless represented through explicit generic domain capabilities.\n\n## UX goals\n\nThe visual delight should live primarily inside the World:\n- characters;\n- environments;\n- animation;\n- objectives;\n- success/failure visual feedback.\n\nThe product chrome should remain calm and modern.\n\n## Acceptance\n\n- [ ] adding a World does not require changing canonical program schema;\n- [ ] mission identity remains locale-independent;\n- [ ] world assets can be localized/themed without logic forks;\n- [ ] same mission semantics can render across Web and Studio World Preview;\n- [ ] initial World has accessible reduced-motion behavior;\n- [ ] assets/license requirements are documented.\n\n## Non-goal\n\nDo not build a generic game engine beyond what learning missions need.","createdAt":"2026-09-27T01:28:07Z","labels":[],"milestone":null,"number":119,"state":"OPEN","stateReason":"","title":"Define Agorix Worlds architecture and world-first mission experience","updatedAt":"2026-09-27T01:28:07Z","url":"https://github.com/Modern-Ash/agorix/issues/119"}

## Standard error

    (empty)
