---
schema: "agora/tool-result/v1"
run: "ai-dlc-start-issue-79"
status: "completed"
exit-code: 0
result-kind: "work-item"
---

# Tool result ai-dlc-start-issue-79

## Standard output

    {"assignees":[],"body":"## Parent\n#65\n\n## Objective\n\nGeneralize the current single textual code generator into a provider-independent, deterministic **LanguageProjection** boundary.\n\n## Read first\n\n- packages/code-generator\n- docs/architecture/PROGRAMMING_MODEL.md\n- docs/architecture/SYSTEM_DESIGN.md\n- issue #16 implementation/tests\n- #65\n\n## Required contract\n\nA projection must consume canonical program state and return:\n- language/projection id;\n- version;\n- deterministic text;\n- canonical node id -> one or more text ranges;\n- optional structural metadata for highlighting/comparison;\n- explicit unsupported-operation diagnostics.\n\n## Architecture rules\n\n- canonical program remains the only programming authority;\n- projections do not mutate canonical state;\n- projections have no provider/LLM dependency;\n- projections are deterministic;\n- projection output is not executed as arbitrary source code in the current runtime;\n- adding a language must not modify program semantics.\n\n## Deliverables\n\n- architecture doc/ADR;\n- TypeScript interface/types;\n- migration plan for the existing TypeScript-like code generator;\n- conformance test helper reusable by each projection.\n\n## Acceptance\n\n- [ ] existing code-generator behavior can be represented by the new contract;\n- [ ] node-to-text mapping is language-independent at the API level;\n- [ ] unsupported canonical nodes fail explicitly;\n- [ ] formatting is deterministic;\n- [ ] projections can be registered/discovered without domain coupling to UI;\n- [ ] tests prove two independent projection implementations can satisfy the same contract.\n\n## Evidence\n\nUnit tests plus architecture review.","createdAt":"2026-09-26T22:59:14Z","labels":[],"milestone":null,"number":79,"state":"OPEN","stateReason":"","title":"Define LanguageProjection contract and canonical node-to-text mapping API","updatedAt":"2026-09-26T22:59:14Z","url":"https://github.com/Modern-Ash/agorix/issues/79"}

## Standard error

    (empty)
