# Agora session context

## Project

- Name: agorix
- Root: `/home/faguero/dev-agora/agorix`

## Runtime

- Integration: `generic`
- Provider: `agorix`
- Model: `opencode`
- Execution profile: `balanced`

## Responsible actor

- Identity: `project:ai-runtime-2`
- Kind: `ai-agent`
- Roles: `developer`
- Capabilities: `implementation`, `operations`, `specification`
- Represented swarm: `none`

## Executor

- Identity: `project:ai-runtime-2`
- Kind: `ai-agent`
- Capabilities: `implementation`, `operations`, `specification`
- Represented swarm: `none`
- Authority: bounded by the responsible actor's assigned roles; execution does not transfer ownership or approval authority.

## Swarm

- Id: `persistence`
- Method: `ai-sdlc`
- Objective: Implement versioned local project persistence and migrations boundary (issue #28)

## Active work

- Id: `versioned-local-persistence`
- Title: Issue #28: versioned local project persistence and migrations boundary
- State: `inception`
- Path: `.agora/swarms/007-persistence/work/versioned-local-persistence`

## Decision snapshot

- Token: `ee0b292208481d2ec0b0e3f04377d4c5e27299e3bb4ae6207355ccf5e1e2c5a2`
- Refresh: `agora work inspect --swarm $AGORA_SWARM --work $AGORA_WORK --snapshot-token ee0b292208481d2ec0b0e3f04377d4c5e27299e3bb4ae6207355ccf5e1e2c5a2`

## Required reading

- `.agora/project.md`
- `.agora/constitution.md`
- `.agora/PROTOCOL.md`
- `.agora/STANDARDS.md`
- `.agora/tools/TOOLS.md`
- `.agora/swarms/007-persistence/SWARM.md`
- `.agora/methods/ai-sdlc/METHOD.md`
- `.agora/methods/ai-sdlc/PROTOCOL.md`
- `.agora/methods/ai-sdlc/roles/developer.md`
- `.agora/swarms/007-persistence/work/versioned-local-persistence/WORK.md`
- `.agora/swarms/007-persistence/work/versioned-local-persistence/artifacts.md`
- `.agora/swarms/007-persistence/work/versioned-local-persistence/evidence.md`
- `.agora/swarms/007-persistence/work/versioned-local-persistence/approvals.md`

## Operating rules

1. Start from the bounded decision snapshot. Read the listed policy and active-work records, then expand only to a targeted file or small range required by the next action. Never read `.agora/activity.md` or an entire event ledger for session orientation.
2. Perform only actions allowed to the assigned role and active transition.
3. Use the Agora CLI to persist state, artifacts, evidence, and material outcomes.
   Agora engine progress is emitted line-by-line on stderr; keep `AGORA_TRACE` enabled so chat hosts can relay each governed step.
4. Do not treat unrecorded conversation history as durable project state.
5. Stop when policy, permissions, or a gate cannot be satisfied.
   5a. Pause and ask the human one concrete question — a line of context, the choice, and a recommended default — before any material decision, human-only approval, gate transition, or unapproved external, destructive, or costly action. When nothing needs a decision or confirmation, act without asking.
   5b. End the turn once the requested step is done or the next move is not yours to make. Do not continue into unrelated checks, and do not restate what was already reported. Silence is fine when there is nothing to confirm or decide.
6. Act as the executor named above; do not claim ownership or human approval on behalf of the responsible actor.
7. Report only meaningful execution milestones with `agora session progress --session $AGORA_SESSION_ID --by $AGORA_EXECUTOR --summary "..."`; never report chain-of-thought or private reasoning.
8. Keep commands quiet and bounded: prefer summaries, narrow test targets, small line ranges, and references to durable artifacts over full diffs, source trees, or build logs. Read only the selected `.agora/environments/<id>.md` immediately before an environment-aware tool operation.
