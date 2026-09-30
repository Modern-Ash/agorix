---
schema: "agora/tool-run/v1"
id: "ai-sdlc-issue-87-pull-request"
tool: "github-pull-requests"
operation: "create"
actor: "project:ai-opencode"
swarm: "issue-87-delivery"
work: "issue-87"
environment: null
capability: "review.write"
risk: "write"
inputs: {"project":"Modern-Ash/agorix","base":"main","head":"ai-sdlc/issue-87","title":"feat: deliver issue-87","description":"Governed Agora AI-SDLC delivery for Deliver GitHub issue #87.\n\nWork: issue-87-delivery/issue-87"}
command: ["gh","pr","create","--repo","Modern-Ash/agorix","--base","main","--head","ai-sdlc/issue-87","--title","feat: deliver issue-87","--body","Governed Agora AI-SDLC delivery for Deliver GitHub issue #87.\n\nWork: issue-87-delivery/issue-87"]
runtime-available: true
status: "completed"
result-kind: "code-review"
timeout-seconds: 300
max-output-bytes: 1048576
authentication-reference: "github-cli-profile"
created-at: "2026-09-30T12:13:54.155535Z"
exit-code: 0
authentication-verified: false
authentication-fingerprint: null
authentication-public-key: null
authorization-sha256: null
authorization-signature: null
---

# Tool run ai-sdlc-issue-87-pull-request

This record contains invocation metadata, not credentials. Authentication is resolved by the external executable and its environment.
