# ADR 0004: Runtime authority and observable execution

## Status

Accepted for the #74 transparent programming contract.

## Context

Agorix is AI-native, but its product promise is not that AI secretly writes or proves programs. The learner must be able to inspect the chain from intent to proposed change, accepted canonical program, current instruction, runtime state transition and visible result.

The architecture already separates:

- `ProjectProgram` as canonical accepted program state;
- visual blocks and language/code views as projections;
- `ProgramProposal` as provisional proposed change;
- deterministic runtime observations as behavior evidence;
- Learning Companion explanations as coaching grounded in context and evidence.

Without an explicit decision, future implementations could blur AI explanation, proposal preview and accepted execution. That would violate "Nothing happens under the rug".

## Decision

Runtime evidence is the authority for execution behavior and mission completion. AI output is never execution proof.

AI-originated program changes must remain provisional until a learner accepts or modifies them through a visible review affordance. Only accepted canonical `ProjectProgram` state is executable. Runtime executes canonical program state, not generated text, raw Blockly data, provider output or chat content.

All surfaces must expose equivalent semantics:

```text
intent -> proposal -> affected region -> preview/diff -> learner decision -> canonical mutation -> runtime evidence
```

Web/Tablet may present this as proposal cards, Action Palette and compact traces. Studio may present it as diff review, code ranges, World Preview and Execution Inspector. These are affordance differences, not semantic differences.

## Rationale

- Children should learn causal programming relationships, not prompt-and-believe behavior.
- Deterministic runtime facts are testable; model confidence and prose are not.
- Keeping proposals outside canonical state prevents invisible AI mutation.
- Keeping generated text as projection avoids dual-authority execution problems.
- Shared semantics let Web/Tablet and Studio interoperate without product forks.

## Consequences

- #75 must implement proposal preview/diff without mutating canonical state before acceptance.
- #76 must implement Step from canonical program/runtime boundaries and expose current instruction mapping.
- #77 must derive trace/evidence from runtime observations, not AI summaries.
- #78 must fail if AI mutation is hidden, code visibility is lost, or runtime evidence is bypassed.
- Learning Companion copy can explain or challenge only from supplied mission context, canonical snapshots and runtime evidence.
- Future provider adapters cannot add provider-specific execution authority to domain contracts.

## Rejected alternatives

### Let AI directly patch learner programs when confidence is high

Rejected because confidence is not deterministic evidence and invisible mutation breaks learner agency.

### Treat generated textual code as the executable source

Rejected for the current architecture because text projection is a learning surface. Runtime executes canonical program state.

### Use separate Web and Studio proposal semantics

Rejected because cross-surface compatibility requires identical canonical project and proposal semantics.
