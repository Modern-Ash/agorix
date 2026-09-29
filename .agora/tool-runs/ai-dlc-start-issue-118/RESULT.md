---
schema: "agora/tool-result/v1"
run: "ai-dlc-start-issue-118"
status: "completed"
exit-code: 0
result-kind: "work-item"
---

# Tool result ai-dlc-start-issue-118

## Standard output

    {"assignees":[],"body":"## Parent\n#116\n\n## Objective\n\nReplace the current desktop-editor-first shell with a **tablet-first learning surface** where World + Code are the two dominant persistent surfaces.\n\nResponsive desktop support remains required, but tablet is a primary target rather than a smoke-test viewport.\n\n## Primary layout\n\nLandscape target:\n\n```text\nMission / progress\n-------------------------------\nWorld              | Code\n                   |\n-------------------------------\nAction  Reset  Step  Run\n-------------------------------\nContextual AI / feedback\n```\n\nPortrait target:\n\n```text\nMission\nWorld\nCode\nControls\nContextual AI\n```\n\nCode must remain inspectable; do not hide it behind an “advanced” tab.\n\n## Requirements\n\n- World and Code dominate visual hierarchy;\n- mission/progress becomes compact chrome, not a large competing panel;\n- permanent left toolbox is removed or minimized;\n- actions are opened through a contextual Action Palette/bottom sheet;\n- Learning Companion is contextual, not a permanently dominant chat panel;\n- Run / Step / Stop / Reset are touch-friendly;\n- layout survives orientation change without losing state;\n- virtual keyboard must not destroy critical controls;\n- safe-area handling for tablets/PWA;\n- no hover-only interaction.\n\n## Target viewport classes\n\nAt minimum validate representative:\n- 768x1024 portrait;\n- 820x1180 portrait;\n- 1024x768 landscape;\n- 1180x820 landscape;\n- 1366x1024 landscape;\n- desktop.\n\nExact device branding is unnecessary; test capability classes.\n\n## Acceptance\n\n- [ ] tablet landscape is first-class;\n- [ ] tablet portrait is functional;\n- [ ] code remains visible/inspectable in both orientations;\n- [ ] World is visually primary;\n- [ ] controls meet touch target guidance;\n- [ ] orientation change preserves canonical state;\n- [ ] no permanent toolbox consumes major screen width;\n- [ ] no permanent full-height tutor panel required for normal flow;\n- [ ] keyboard and touch navigation both work;\n- [ ] Playwright covers tablet landscape + portrait.\n\n## Dependencies\n\n- design system issue under #116;\n- #74 UX contract;\n- #110 localization requirements.","createdAt":"2026-09-27T01:28:05Z","labels":[],"milestone":null,"number":118,"state":"OPEN","stateReason":"","title":"Build tablet-first Agorix Web application shell","updatedAt":"2026-09-27T01:28:05Z","url":"https://github.com/Modern-Ash/agorix/issues/118"}

## Standard error

    (empty)
