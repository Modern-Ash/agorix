---
schema: "agora/tool-result/v1"
run: "ai-dlc-start-issue-121"
status: "completed"
exit-code: 0
result-kind: "work-item"
---

# Tool result ai-dlc-start-issue-121

## Standard output

    {"assignees":[],"body":"## Parent\n#116\n\n## Objective\n\nMake “one product, multiple surfaces” a testable invariant.\n\nA project created on Web/Tablet must open in Agorix Studio with the same semantics, and vice versa.\n\n## Required invariant\n\n```text\nWeb / Tablet\n    |\nsave project\n    v\nCanonical Project\n    |\nopen\n    v\nAgorix Studio\n    |\nmodify canonical state\n    v\nCanonical Project\n    |\nreopen\n    v\nWeb / Tablet\n```\n\n## What must remain identical\n\n- canonical program;\n- mission id/version;\n- runtime semantics;\n- project version;\n- LanguageProjection semantics;\n- learner-approved ProgramProposal results;\n- relevant progression state.\n\n## What may differ\n\nPresentation-only state may differ:\n- selected panel;\n- editor split size;\n- dark/light theme;\n- Studio file/editor focus;\n- tablet orientation.\n\nLocale and selected projection are presentation/user preferences and must be handled explicitly rather than hidden inside canonical semantics.\n\n## Deliverables\n\n- cross-surface compatibility contract;\n- project serialization/version rules;\n- migration policy;\n- compatibility test fixtures;\n- Studio/Web fixture round trip.\n\n## Acceptance\n\n- [ ] Web-created project opens in Studio;\n- [ ] Studio-created/modified canonical project opens in Web;\n- [ ] semantic hash/equivalence preserved through round trip;\n- [ ] unsupported newer schema fails explicitly;\n- [ ] presentation state does not contaminate program state;\n- [ ] locale switch remains independent;\n- [ ] no UI-specific identifiers leak into canonical model.\n\n## Evidence\n\nProvide a deterministic fixture and automated round-trip test.","createdAt":"2026-09-27T01:28:10Z","labels":[],"milestone":null,"number":121,"state":"OPEN","stateReason":"","title":"Prove cross-surface project compatibility between Web and Agorix Studio","updatedAt":"2026-09-27T01:28:10Z","url":"https://github.com/Modern-Ash/agorix/issues/121"}

## Standard error

    (empty)
