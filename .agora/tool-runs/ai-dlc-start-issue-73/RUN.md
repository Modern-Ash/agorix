---
schema: "agora/tool-run/v1"
id: "ai-dlc-start-issue-73"
tool: "github-issues"
operation: "view"
actor: "project:product-owner"
swarm: "issue-73-delivery"
work: null
environment: null
capability: "issue.read"
risk: "read"
inputs: {"issue":"https://github.com/Modern-Ash/agorix/issues/73"}
command: ["gh","issue","view","https://github.com/Modern-Ash/agorix/issues/73","--json","number,title,body,state,stateReason,labels,assignees,milestone,url,createdAt,updatedAt"]
runtime-available: true
status: "completed"
result-kind: "work-item"
timeout-seconds: 300
max-output-bytes: 1048576
authentication-reference: "github-cli-profile"
created-at: "2026-09-27T01:41:06.023510Z"
exit-code: 0
authentication-verified: false
authentication-fingerprint: null
authentication-public-key: null
authorization-sha256: null
authorization-signature: null
---

# Tool run ai-dlc-start-issue-73

This record contains invocation metadata, not credentials. Authentication is resolved by the external executable and its environment.
