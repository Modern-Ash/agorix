---
schema: "agora/evidence-entry/v3"
id: "evidence-000001"
type: "test-suite"
phase: "construction"
result: "success"
revision: 1
artifact-references: [".agora/ai-sdlc/handoffs/issue-121/VERIFICATION_EVIDENCE.md"]
artifact-content-sha256: {".agora/ai-sdlc/handoffs/issue-121/VERIFICATION_EVIDENCE.md":null}
produced-by: "project:ai-codex"
timestamp: "2026-09-27T10:44:12.176497Z"
tested-commit: "6e9d3c35efb1b4ac595092c75fefc35ccf67e7c5"
command: ["pnpm format:check","pnpm lint","pnpm build","pnpm test","aisdlc verify --root . --swarm issue-121-delivery --work issue-121 --run --json"]
exit-code: 0
tests-total: 152
tests-passed: 152
tests-failed: 0
environment: "local Node v20.19.0; repo engine warns Node >=22 <23"
dedupe-key: "issue-121-cross-surface-compatibility"
---

# Evidence evidence-000001

This append-only record captures a governed verification fact. Provider output and credentials are intentionally excluded.
