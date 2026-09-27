---
schema: "agora/tool-result/v1"
run: "ai-dlc-start-issue-92"
status: "completed"
exit-code: 0
result-kind: "work-item"
---

# Tool result ai-dlc-start-issue-92

## Standard output

    {"assignees":[],"body":"## Parent\n#67\n\n## Objective\n\nDefine the runtime/provider boundary used by LearningCompanion capabilities without coupling Agorix domain code to any vendor SDK or model family.\n\n## Read first\n\n- package(s) implementing current tutor provider boundary\n- #85\n- docs/architecture/SYSTEM_DESIGN.md\n- docs/safety/CHILD_SAFETY_PRIVACY.md\n- #67\n\n## Contract responsibilities\n\nProvider runtime should expose:\n- provider/runtime id;\n- model id/config;\n- supported capabilities;\n- structured request/response transport;\n- timeout/cancellation;\n- context/token constraints where known;\n- local/remote indicator;\n- health/availability;\n- error taxonomy;\n- no domain-level provider-specific payloads.\n\n## Capability negotiation\n\nAgorix should be able to determine whether a configured runtime supports:\n- structured JSON/schema output;\n- tool/function calling if used;\n- streaming if used;\n- local execution;\n- specific context limits;\n- capability classes required by LearningCompanion.\n\nThe domain must degrade gracefully when a capability is unavailable.\n\n## Security\n\n- credentials/server secrets never enter browser bundle;\n- no raw child free text logging by default;\n- provider-specific metadata is isolated behind adapter boundary;\n- request minimization remains enforceable above provider layer.\n\n## Acceptance\n\n- [ ] domain contracts compile without vendor SDKs;\n- [ ] at least two fake adapters with different capability sets pass tests;\n- [ ] capability mismatch is explicit;\n- [ ] timeout/cancel/error behavior normalized;\n- [ ] local and remote adapters use same interface;\n- [ ] provider/model can be changed through configuration;\n- [ ] architecture documents dependency direction.\n\n## Evidence\n\nContract tests + adapter conformance harness.","createdAt":"2026-09-26T23:01:06Z","labels":[],"milestone":null,"number":92,"state":"OPEN","stateReason":"","title":"Define provider-neutral LLM runtime and capability negotiation contract","updatedAt":"2026-09-26T23:01:06Z","url":"https://github.com/Modern-Ash/agorix/issues/92"}

## Standard error

    (empty)
