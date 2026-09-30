# Agorix / Agora retrospective

Evidence snapshot: 2026-09-30.

This retrospective separates observations supported by the Agorix repository from framework
experiments that are still open under #33/#34.

## What reduced ambiguity

The strongest contracts were:

- one canonical `ProjectProgram`;
- deterministic runtime as behavioral authority;
- ProgramProposal as the only AI-originated mutation proposal boundary;
- LanguageProjection as read-only representation;
- LearningCompanion capability contracts;
- LearningRequirements between pedagogical decision and provider routing;
- explicit issue acceptance criteria and deterministic E2E scenarios.

These contracts let later features reuse authority boundaries instead of redefining them.

## Where context/tokens were wasted

Repository history and the implementation sequence exposed recurring friction in:

- repairing stale/dirty Agora project evidence during dogfood rather than testing new work;
- CI formatting debt being merged repeatedly and causing unrelated PRs to remain red;
- issues/epics remaining administratively open after their children were already complete;
- discovering hidden compatibility expectations only in browser E2E, such as TypeScript being the
  existing default Code Surface;
- treating deterministic decisions as potential LLM work before System-0/Laya routing was added.

The Decision Plane work directly addresses the last item by preferring deterministic resolution,
then Laya classification, then local/remote generation only when needed.

## Product invariants that required the most care

1. AI proposal must never silently mutate canonical state.
2. Runtime evidence must never be manufactured by a model.
3. Multiple textual languages must never create multiple program authorities.
4. Web and Studio must share semantics while allowing different presentation.
5. Provider/model identity must remain downstream of pedagogy and safety.
6. Child-facing AI provenance must distinguish suggestion, accepted program and runtime fact.

## Core vs AI-SDLC vs Agorix

### Agora Core

Own durable governance facts and authority: lifecycle, evidence, review/provenance facts and gates.

### Agora AI-SDLC

Own workflow projection/orchestration, bounded context, Decision Plane integration and economical
routing policy for software-delivery agents.

### Agorix

Own product pedagogy and domain semantics: canonical learner program, runtime, curriculum,
Learning Companion, ProgramProposal semantics, LanguageProjection and child-facing Decision Plane
requirements.

Laya is advisory System-1 classification; it is not a replacement for any of these authorities.

## Open-source/local-model friction

The repository supports local/open adapter paths and Laya integration, but live model quality,
hardware requirements and model-specific structured-output reliability are deployment observations,
not proven equivalent by CI. #98 remains the place to document reproducible self-hosted modes.

## What is not yet proven about Agora

#33 and #34 remain open. Until their evidence is committed, this retrospective does not claim:

- three distinct agent families were systematically sampled;
- two documented producer/reviewer pairs used distinct agents/providers;
- exact artifact-digest stale-review behavior was demonstrated in Agorix evidence docs;
- complete token/usage metrics were captured across representative work.

Those are framework-validation gaps, not Agorix MVP product gaps.

## Product conclusion

Agorix now has a coherent MVP path in which a learner can inspect an AI suggestion, predict,
accept/reject, execute, observe deterministic evidence, correct the program, compare textual
representations and reflect. Web/Tablet and Studio reuse the same canonical semantics.

Deployment breadth, native packaging and advanced model-comparison curriculum remain deliberate
follow-up work.
