# Agorix Studio Agent

Traces to epic #242 and issue #243. Builds on #204, #210 and #211.

## Purpose

The Studio Agent is the AI-native layer of Agorix Studio for learners who already handle the Web app. It teaches learners to **work with AI** as a skill, not to receive answers from it.

Studio is not Scratch with a chat panel. The agent is a participant in the programming workflow: it notices, offers, proposes and explains, always through visible, reversible, evidence-checked steps.

## Learner stages served

From [`LEARNING_PROGRESSION.md`](./LEARNING_PROGRESSION.md):

| Stage       | Studio Agent role                                                             |
| ----------- | ----------------------------------------------------------------------------- |
| Collaborate | Offers bounded proposals; learner evaluates before accepting.                 |
| Create      | Coaches planning, review and debugging; does not complete the work.           |
| Critique    | Surfaces alternatives and trade-offs; learner decides and defends with proof. |

Explore, Connect and Translate stay primarily on Web. Studio may still open them.

## Pedagogical paradigm: Director and Auditor

The learner **directs** and **audits**. The agent builds in bounded steps.

```text
learner states intent            (Director)
  -> agent asks at most one clarifying question
  -> learner accepts/edits a plan
  -> agent builds a bounded ProgramProposal
  -> learner PREDICTS what it will do        (Auditor)
  -> learner accepts / rejects / modifies
  -> deterministic runtime PROVES
  -> learner compares prediction vs evidence
  -> learner EXPLAINS one relevant concept or change
```

Skills trained: delegating with clear intent, predicting before trusting, verifying with evidence, explaining decisions. AI is fallible support, never authority; runtime evidence outranks fluent language.

### Rules carried over from PEDAGOGY.md

- Questions and hints before complete solutions; a complete solution only after repeated failure and an explicit request.
- The agent never changes the accepted program on its own.
- The agent never hides code or proposal diffs.
- The agent never claims behavior the runtime has not observed.
- Mission completion never depends on AI judgment.
- No personal data is requested for personalization.
- Reflection never blocks basic completion.

### Alternatives and honesty

When the agent offers alternatives they are real approaches with real trade-offs. The agent never plants bugs or deliberately misleads to teach critique.

## Interaction model

Two entry modes, no chat panel as the primary surface.

1. **Ambient.** Status indicator, CodeLens and code actions on selected or erroring nodes, node-anchored hints, ghost nodes on the canvas. Labels are short; icons and state come first.
2. **Intent bar.** A keyboard-first quick-input where the learner says what they want to achieve. It leads to a plan and then to a proposal. It is not a transcript.

Agent output is data the learner can inspect: a plan checklist, a ProgramProposal, a highlighted node, a short explanation tied to evidence. Long free-form text is secondary and available on demand.

AI artifacts always use the AI-provisional visual treatment (never success styling) and carry a provenance/uncertainty signal.

## Proactivity policy

**Silence is a first-class outcome.** The default is to say nothing.

The decision to offer is made by System 0 (deterministic rules) or LAYA (System 1), never by a provider call.

The agent stays silent when:

- the learner is running, stepping or typing;
- the learner declined an offer for this program;
- the decline cap is reached (`PROACTIVE_MAX_DECLINES`, currently 2) or a cooldown is active;
- the evidence is too weak (for example `PROACTIVE_MIN_OCCURRENCES` not met);
- AI is disabled or the session budget is exhausted.

Signals covered at Web today: `repeat-pattern`, `first-step`. Studio adds `runtime-error`, `stalled` and `repeated-error` (issue #245). An offer says what the agent can do (explain, debug, challenge, propose); it carries no generated content until the learner accepts.

## Cost architecture (LAYA)

```text
signal (selection, error, stall, pattern, intent)
  -> System 0: deterministic rules               cost 0, no network
  -> System 1: LAYA decideMany                    small local model; batched, cached,
                                                  confidence + abstention
  -> LearningRequirements
       generativeNeeded, reasoningTier, contextNeed, solutionAllowance, ...
  -> generativeNeeded = "no"  -> deterministic answer, zero tokens
  -> routeLearningRequirements -> deterministic | local | remote
  -> provider adapter behind the server boundary
```

- LAYA decides whether a model is needed, which tier and how much context. It does not generate text.
- If LAYA is unavailable or abstains, System 0 defaults apply (`DecisionSource` = `fallback`).
- Decisions are cached per (program hash, signal, scaffold level).
- Local tier is preferred; remote requires explicit opt-in.
- A per-session budget (tokens and/or requests) degrades the agent to deterministic responses and tells the learner plainly.
- Developer diagnostics (route, tier, cost) live behind progressive disclosure and are never authority.

## Context contract

The agent sees only a bounded, sanitized context: mission id/version, learning target, canonical program snapshot, selected node ids/ranges, deterministic runtime observations, scaffold history and locale. It never sees file paths outside the project, account fields, or raw free text the learner did not submit. See `LEARNING_COMPANION.md` (Grounding, Guardrails).

## Proposal pipeline

Unchanged from `AGENTS.md`:

```text
learner intent -> Learning Companion proposal -> structured validation
  -> learner-visible preview/diff -> accept / reject / modify
  -> canonical program mutation -> deterministic runtime -> runtime evidence
```

The preview is a native VS Code diff first (#211) and ghost nodes on the canvas later. Both are views of the same ProgramProposal.

## Availability

Everything works with the agent disabled: editing, running, canvas, code, preview, inspector, missions. The agent surface shows a calm "unavailable" state and nothing else changes. Core build and tests need no provider credentials.

## Telemetry and evidence contract (non-PII)

Allowed events: proposal requested/accepted/rejected/modified, prediction correct/incorrect, alternative chosen, explain completed/skipped, completion after scaffold, proactive offer shown/accepted/dismissed, route decisions and cost.

Allowed fields: mission id, program hash, role, scaffold level, decision source, reasoning tier, cache hit, token estimates, timing buckets, provider locality.

Never logged: learner free text, names, emails, file paths, account/session ids, provider credentials, raw model output. Storage is local-first; exports follow `docs/safety/CHILD_SAFETY_PRIVACY.md`.

## Canvas

The Studio canvas is an IDE-native **projection** of the canonical program, complementing the code-first editor. See [ADR 0006](../architecture/adr/0006-studio-agent-and-canvas.md) for how this reconciles with #204 and #196.

## Work breakdown

Epic #242. Foundations #243. Phase 1 agent core #244-#251. Phase 2 canvas #252-#255. Phase 3 agent on the canvas #256-#258. Release gate #259.
