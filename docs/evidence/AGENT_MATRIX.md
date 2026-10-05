# Agorix multi-agent delivery matrix

Evidence snapshot: 2026-10-05.

This matrix supports GitHub issue #33. It records observable agent/runtime use in
real Agorix work. It is not a benchmark and does not claim a universal best
model. Missing coverage is recorded as missing rather than inferred from private
chat history.

## Summary

| Requirement                                                       | Status                       | Evidence                                                                                                                                           |
| ----------------------------------------------------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| At least 3 distinct agent families exercised if accessible        | Partially demonstrated       | OpenCode/Ollama and Agora `ai-codex` have durable Core evidence; Claude appears as a co-author in PR #158. No durable Copilot run was found.       |
| At least 2 producer/reviewer pairs use different agents/providers | Partially demonstrated       | Human Product Owner/merge gates are distinct from agent producers. Durable reviewer-runtime evidence is incomplete.                                |
| No agent self-merges                                              | Demonstrated for sampled PRs | PRs #158, #283 and #284 were authored/merged through GitHub user `fabianaguero`, not an agent bot account.                                         |
| Switching agents uses repo/issues/artifacts, not private chat     | Demonstrated with caveat     | Issue #87, #79, #101 and #34 evidence is reproducible from repo docs/Core/GitHub metadata; some modern Codex session provenance remains chat-side. |
| Results committed to this file                                    | Demonstrated                 | This file.                                                                                                                                         |
| Actual limitations documented factually                           | Demonstrated                 | See Limitations.                                                                                                                                   |

## Sampled Work

| Work                                    | SDLC role                          | Producing runtime/provider/model                                                                                              | Durable provenance                                                                              | Commit/PR/artifacts                                                                                                          | CI/evidence                                                                                                                                                   | Reviewer / gate                                                                    | Defects or rework observed                                                                                                                                                                  |
| --------------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Issue #8 POC learner journey inception  | Inception producer                 | OpenCode 1.18.32 over Ollama `qwen3:8b`                                                                                       | `docs/experiment/AI_SDLC_DOGFOOD.md` records runtime layering and issue #8 handoff              | Product artifact `docs/product/LEARNER_JOURNEY.md` was revised locally during the experiment                                 | Construction not started; no PR evidence for this sampled run                                                                                                 | Independent review required before construction                                    | Review found governance wording that implied unrecorded approvals; artifact was reworded to "human-selected POC decision". Later run exposed work-binding and invalid artifact parser gaps. |
| Issue #79 multi-language projection     | Developer / artifact producer      | Agora actor `project:ai-codex`; actor file records model `opencode` at that time                                              | `.agora/swarms/025-issue-79-delivery/work/issue-79/*`                                           | Core artifacts include intent, requirements, plans, verification report and evidence digests                                 | Build/test/verification evidence all success in `.agora/swarms/025-issue-79-delivery/work/issue-79/evidence.md`                                               | Human Product Owner approved inception; developer approval was authorized by human | Demonstrates portable Core artifact production and evidence, but not an independent code-review runtime.                                                                                    |
| Issue #87 proposal stale-state behavior | Construction / operations producer | `project:ai-opencode`; economics telemetry records `opencode` with model `big-pickle`                                         | `.agora/ai-sdlc/operations/issue-87/*`, `.agora/events.md`, `docs/evidence/AGORA_PROJECTION.md` | PR #158, merged 2026-09-30; final trail commit co-authored by Claude Sonnet 5.5                                              | PR #158 CI passed lockfile, lint, format, typecheck, unit-tests, build, browser-smoke, dependency-scan, security-baseline and verify                          | Human Product Owner/Core close and GitHub merge; no GitHub code reviews recorded   | Operations evidence caught stale/dirty-tree risk before PR creation; later PR restored reviewable committed state.                                                                          |
| Issue #101 model-comparison activity    | Builder / implementation producer  | Codex session in this workspace; Git metadata is human-authored, so durable agent identity is weaker than Core actor evidence | PR #283 and issue #101 update comment                                                           | Commit `e16511b395f6b4f2b532ee7807c56994a219d6ec`; PR #283 merged 2026-10-05                                                 | PR #283 CI passed twice, including browser and VS Code smoke checks                                                                                           | Human GitHub merge; no GitHub reviews recorded                                     | Implementation intentionally left UI/e2e flow open; issue #101 now records the remaining UI scenario.                                                                                       |
| Issue #34 projection evidence           | Evidence producer                  | Codex session in this workspace; Git metadata is human-authored                                                               | PR #284, `docs/evidence/AGORA_PROJECTION.md`                                                    | Commits `582b96c23d214eb0f6ecb58e316b39e49fd7bb6c` and `f6d77e0b868983bf18f2864f6444f6316d2ba7b3`; PR #284 merged 2026-10-05 | PR #284 CI passed lockfile, lint, format, typecheck, unit-tests, build, browser-smoke, both VS Code smoke jobs, dependency-scan, security-baseline and verify | Human GitHub merge; no GitHub reviews recorded                                     | The evidence document narrows the remaining gap: no distinct digest-bound independent review record yet.                                                                                    |

## Agent Families Observed

| Family / runtime              | Evidence strength   | Where observed                                                   | Notes                                                                                                                            |
| ----------------------------- | ------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| OpenCode + Ollama local model | Strong              | `docs/experiment/AI_SDLC_DOGFOOD.md`                             | Recorded with OpenCode 1.18.32, Ollama and `qwen3:8b` for issue #8 inception.                                                    |
| Agora `project:ai-opencode`   | Strong              | Issue #87 Core events, economics telemetry and PR #158           | Recorded as producer for construction/operations evidence and repository tool runs.                                              |
| Agora `project:ai-codex`      | Strong              | Issue #79 Core artifacts/evidence                                | Recorded as artifact/evidence producer. The actor's configured model is historical and should not be treated as a product claim. |
| Codex chat/runtime            | Medium              | PR #283/#284 work in this thread and issue comments              | Work is visible in GitHub commits/PRs, but durable repo metadata does not encode the Codex session identity.                     |
| Claude / Claude Sonnet        | Limited but durable | PR #158 commit `622a4ca` has `Co-Authored-By: Claude Sonnet 5.5` | Co-author evidence exists, but the role was completion-trail documentation rather than an independent review.                    |
| GitHub Copilot                | Not demonstrated    | No durable sampled work found                                    | Do not count toward #33 without a future PR/artifact that records Copilot use.                                                   |

## Producer / Reviewer Separation

| Pair                                                               | Separation               | Evidence                            | Limitation                                                                |
| ------------------------------------------------------------------ | ------------------------ | ----------------------------------- | ------------------------------------------------------------------------- |
| `project:ai-opencode` producer -> human Product Owner/GitHub merge | Distinct human gate      | Issue #87 Core revision and PR #158 | Not a digest-bound code review by another agent.                          |
| `project:ai-codex` producer -> human Product Owner approval        | Distinct human gate      | Issue #79 approvals                 | Inception approval, not independent code review.                          |
| Codex-produced PR #283/#284 -> human GitHub merge                  | Distinct merge authority | GitHub PR metadata                  | GitHub reviews are empty; agent identity is not durable in repo metadata. |

## Limitations

- Copilot or equivalent Copilot workflow was not found in durable evidence and is
  not counted.
- Claude appears durably only as a co-author on one PR commit, not as a complete
  producer/reviewer sample.
- GitHub PR metadata records human authors/merges for several agent-assisted
  sessions, so chat-side agent identity cannot be independently reconstructed
  from Git alone.
- Producer/reviewer separation is stronger at the human gate level than at the
  digest-bound independent-agent-review level. Issue #34 tracks the remaining
  digest-bound review gap.
- Token/cost details are available for some Agora economics events but are not
  uniformly populated across all sampled work.

## Conclusion

Agorix successfully exercised multiple delivery paths without making any one
agent or vendor authoritative. The strongest durable evidence is OpenCode/Ollama
and Agora Core actor provenance; recent Codex work is visible through PRs and CI
but not yet encoded as first-class Core session provenance. Future validation
should focus on one clean, digest-bound review scenario with a different agent
runtime and on one explicit Copilot sample if that environment is available.
