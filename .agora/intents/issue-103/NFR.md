<!-- agora-ai-sdlc:deterministic-inception/v1 -->

# Non-Functional Requirements — issue-103

- No name, school, exact location, or contact data required anywhere in the described flows.
- Raw child free text (`learnerIntent`/`learnerQuestion`) must not be logged by default — now CI-enforced, not just documented.
- Local-only mode's network expectations must be explicit (no external request).
- Remote mode must send only capability-required context.
- Secrets must never enter the client bundle (already enforced by the existing `checkClientSecrets` rule; this issue does not weaken it).
- No silent analytics expansion — any future logging must be checked against this issue's allowlist/denylist.
