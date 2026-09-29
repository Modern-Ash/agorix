---
schema: "agora/tool-result/v1"
run: "ai-dlc-start-issue-36"
status: "completed"
exit-code: 0
result-kind: "work-item"
---

# Tool result ai-dlc-start-issue-36

## Standard output

    {"assignees":[],"body":"## Parent\n#6\n\n## Status\n\n**ACTIVE PRODUCT SURFACE.**\n\nTablet/Web is now a primary Agorix learning surface, not deferred portability work.\n\n## Objective\n\nDeliver Agorix Web as an installable, tablet-first PWA optimized for touch, missions, Worlds and visible code.\n\n## Product role\n\nWeb/Tablet is the primary learning experience for earlier and intermediate stages.\n\nIt must share:\n- Canonical Program;\n- Runtime;\n- Curriculum;\n- Learning Companion;\n- LanguageProjection;\nwith Agorix Studio.\n\n## Dependencies\n\n- #71 revised product/MVP order;\n- #116 Experience & Surface Architecture;\n- #117 design system;\n- #118 tablet-first shell;\n- #120 touch interaction model;\n- #91 AI-native learner loop;\n- #96 provider/offline behavior.\n\n## Required PWA behavior\n\n- installable Web/PWA;\n- application shell available offline after install where practical;\n- core runtime and deterministic fake/offline learning path work without remote LLM;\n- tablet landscape and portrait first-class;\n- orientation changes preserve state;\n- no hover-only control;\n- no provider credentials cached;\n- safe-area handling;\n- app resumes without semantic state loss.\n\n## Required viewport validation\n\nAt minimum:\n- 768x1024;\n- 820x1180;\n- 1024x768;\n- 1180x820;\n- 1366x1024;\n- desktop.\n\n## Acceptance\n\n- [ ] PWA installability requirements pass;\n- [ ] First Mission works touch-only;\n- [ ] code remains inspectable in portrait and landscape;\n- [ ] World + Code dominate layout;\n- [ ] AI proposal flow is usable by touch;\n- [ ] Step execution remains visible;\n- [ ] locale switching from #110 works;\n- [ ] offline/provider-unavailable behavior follows #96;\n- [ ] Playwright covers tablet portrait and landscape.\n\n## Non-goal\n\nNative app-store packaging belongs to #37.","createdAt":"2026-09-21T21:53:22Z","labels":[],"milestone":null,"number":36,"state":"OPEN","stateReason":"","title":"Build tablet-first installable Web/PWA learning surface","updatedAt":"2026-09-27T01:29:20Z","url":"https://github.com/Modern-Ash/agorix/issues/36"}

## Standard error

    (empty)
