---
schema: "agora/clarifications/v1"
swarm: "issue-340-delivery"
work: "issue-340"
created-at: "2026-10-20T21:34:07.008806Z"
last-run-input-sha256: "c2b758fea1d0842bfbf9d9cce5697813558b3f90852d5947c0d1d3b7a912e991"
last-run-question-count: 2
last-run-unanswered-count: 0
last-run-by: "project:ai-claude"
last-run-at: "2026-10-20T21:34:07.008806Z"
---

# Clarifications for issue-340

| Question | Answer | Actor | Timestamp | Input SHA-256 |
| --- | --- | --- | --- | --- |
| Which host port serves the Web container? | 127.0.0.1:8470, reserved and wired to agorix.modern-ash.com in #341 (source fact). | project:ai-claude | 2026-10-20T21:34:07.008806Z | c2b758fea1d0842bfbf9d9cce5697813558b3f90852d5947c0d1d3b7a912e991 |
| Which base image and where do headers come from? | nginx:alpine, matching the host's existing modern-ash-web container; headers mirror apps/web/src/securityHeaders.ts (AI proposal, no material ambiguity left; recorded by deterministic local runner, not an LLM). | project:ai-claude | 2026-10-20T21:34:07.008806Z | c2b758fea1d0842bfbf9d9cce5697813558b3f90852d5947c0d1d3b7a912e991 |
