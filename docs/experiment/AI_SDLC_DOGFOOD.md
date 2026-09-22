# Agorix — Agora AI-SDLC Dogfood Log

## 0. Backlog preparation

Agorix started from product and architecture documents and was decomposed into GitHub EPICs and child issues before running delivery cycles.

### EPICs

- #1 Product foundation and learner experience
- #2 Canonical program model and deterministic runtime
- #3 Visual editor, stage and block-to-text bridge
- #4 Guided learning and first mission
- #5 AI tutor with pedagogical guardrails
- #6 Child safety, persistence, platform quality and CI
- #7 Agora AI-SDLC proof-of-concept validation

GitHub Issues remains the visible work queue. Agora AI-SDLC consumes selected issues and turns them into durable Intents, plans, Units, Bolts, evidence and review records.

## 1. Framework friction found before the first cycle

Dogfooding Agorix exposed several framework issues before implementation started:

- The original `agora-ai-sdlc` command was too long for frequent terminal use, so the short alias `aisdlc` was added.
- The original guided flow exposed too much readiness/gate ceremony for normal feature work, leading to the new `aisdlc start --issue <n>` entry flow.
- GitHub issue Markdown was initially embedded directly inside the Intent outcome; headings such as `## Parent` caused Core to parse an empty Proposed outcome. This was fixed so the Intent stores a stable plain-text outcome and keeps GitHub as the source.
- After `aisdlc start`, the selected runtime is not yet launched automatically with the portable AI-SDLC skill. The user still has to perform a manual handoff. This gap is tracked in Agora AI-SDLC issue #154.

## 2. Cycle 1 — GitHub issue #8

### Source work item

GitHub issue #8:

`Define the POC learner journey and editor information architecture`

Parent EPIC: #1 Product foundation and learner experience.

### AI-SDLC start

Command:

```bash
aisdlc start --issue 8 --agent opencode
```

Result:

- governed GitHub issue read created;
- durable Intent `issue-8` created;
- Intent status: `draft`;
- source: GitHub issue #8;
- selected agent interface: OpenCode;
- human-review boundary reached before Construction.

### Durable Intent

Path:

```text
.agora/intents/issue-8/INTENT.md
```

Problem:

```text
Define the POC learner journey and editor information architecture
```

Proposed outcome:

```text
Deliver the outcome described by GitHub issue #8: Define the POC learner journey and editor information architecture
```

### Runtime used for Inception

The Inception handoff was launched manually with:

- Agent interface: OpenCode 1.18.32
- Model runtime/provider: Ollama
- Model: `qwen3:8b`
- Intent: `issue-8`
- Phase: Inception
- Goal: produce Level 1 Plan, cohesive Units and suggested Bolts
- Construction: not started

This is intentionally recorded as a layered runtime configuration:

```text
Agora AI-SDLC method
        ↓
portable skill
        ↓
agent interface: OpenCode
        ↓
model runtime: Ollama
        ↓
model: qwen3:8b
```

The method must remain independent from all three runtime layers.

## 3. Dogfood finding — Start → Inception handoff

Observed behavior:

- `aisdlc start` correctly creates or reuses a durable Intent.
- It selects a responsive runtime.
- It presents the next methodological actions.
- It does not yet launch the runtime with the portable AI-SDLC skill and bounded context.
- A manual handoff is still required to tell the selected agent to conduct Inception.

Conclusion:

The methodology must travel with the agent. Runtime selection should choose only the executor. The portable AI-SDLC skill should own the behavior from Intent through Level 1 Plan, Units and suggested Bolts, then stop at human review before Construction.

Framework follow-up:

- Agora AI-SDLC issue #154 — Make portable multi-agent skill own Start → Level 1 Plan handoff.

## 4. Current cycle status

Current state:

```text
GitHub issue #8
    ↓
durable Intent issue-8
    ↓
OpenCode
    ↓
Ollama
    ↓
qwen3:8b
    ↓
Inception in progress
    ↓
waiting for Level 1 Plan / Units / Bolts
    ↓
human review required before Construction
```


## 5. Independent review and rework of issue #8

An independent review was performed after the first Inception draft.

### Main finding

The most important finding was not a UX detail but a governance gap: several choices were described as "(approved decision)" in the learner-journey artifact, but Agora had no durable record proving who selected those trade-offs.

This became Agora AI-SDLC issue #155:

`Persist material human Inception decisions as durable AI-SDLC evidence`.

Until that framework gap is resolved, the artifact must not present conversational human choices as if they were auditable Core approvals.

### Rework performed

The producer revised `docs/product/LEARNER_JOURNEY.md` without touching product code.

Changes reported:

- replaced "(approved decision)" with "(human-selected POC decision)";
- added a Decision provenance section listing the human-selected choices;
- documented that those choices are not yet durable Agora approval evidence and reference framework issue #155;
- removed the invented requirement that tutor help requires a prior failed attempt;
- defined the tutor-unavailable stuck-path fallback;
- clarified narrow-viewport stacking and tutor overlap behavior;
- added explicit happy-path and stuck-path mappings;
- clarified Reset semantics;
- defined the unsupported-version load state;
- defined editing behavior while a program is running.

### Current state

- Product code: unchanged.
- `LEARNER_JOURNEY.md`: modified locally, still untracked at the time of this log entry.
- Construction: not started.
- Next step: second independent review of the revised Inception artifact.
