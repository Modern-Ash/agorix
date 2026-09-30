# Learning and pedagogy model

## Learning philosophy

Children learn programming concepts by making visible things happen, predicting what should happen, running the program, observing evidence and explaining the difference between intent and behavior.

Agorix teaches programming with AI in the loop without letting AI replace the thinking step:

> AI proposes. Child decides. Runtime proves. Child explains.

The runtime is the source of truth for behavior. AI explanations, hints and proposals are learning supports; they are never proof that the program works.

## Scaffolding

Scaffolding is temporary support that helps the learner take the next meaningful step while preserving authorship. In Agorix, scaffolding may include:

- asking a clarifying question about the learner's intent;
- decomposing a goal into smaller steps;
- pointing to a relevant block, code region or runtime observation;
- proposing a bounded structure that the learner can inspect;
- explaining why runtime evidence differs from the learner's prediction;
- prompting reflection after success.

Scaffolding must be visible, attributable and removable. It must not silently change the accepted program.

## Gradual release of responsibility

The learning companion should move from more support to less support as the learner gains control:

1. model the thinking with a question or tiny example;
2. guide the learner to inspect the relevant blocks/code/evidence;
3. let the learner choose or edit the next step;
4. ask the learner to predict behavior;
5. rely on runtime evidence;
6. ask the learner to explain the result.

The product should prefer learner action over AI completion whenever the learner can reasonably take the next step.

## Concept progression

1. sequence;
2. events;
3. repetition;
4. conditions;
5. state/variables;
6. decomposition/functions;
7. collections and richer abstractions (post-POC).

The POC needs only sequence, events, repetition and simple conditions, but the model must not prevent later growth.

## Learner loop

The complete learning loop is:

1. learner expresses intent;
2. system or AI asks clarifying or decomposing questions when pedagogically useful;
3. AI may propose a bounded structure or change;
4. learner inspects the proposal;
5. learner accepts, modifies or rejects it;
6. blocks and textual code remain visible;
7. learner predicts behavior where appropriate;
8. runtime executes deterministically;
9. learner observes behavior and runtime evidence;
10. learner and AI debug using runtime facts;
11. learner improves the program;
12. learner explains what changed and why it works.

This loop is the product model. "Ask the tutor when stuck" is only one possible path inside it.

## Proposal, accepted program and executed result

The learner-visible distinction is required:

- **Proposal**: a suggested structure, hint or change. It may come from AI and may be wrong.
- **Accepted program**: the learner-controlled canonical program after inspection and decision.
- **Executed result**: the deterministic runtime behavior produced by the accepted program.

AI may generate proposals. Only learner action may turn a proposal into accepted program state. Only runtime evidence may prove behavior.

## Challenge structure

Each mission has:

- id/version;
- title and child-facing goal;
- concepts;
- starter project;
- completion predicate;
- optional constraints;
- hint/proposal ladder;
- prediction prompt where appropriate;
- reflection prompt.

## Hint and proposal ladder

Level 0: no help.
Level 1: diagnostic question.
Level 2: concept reminder.
Level 3: point to the relevant program area, code region or runtime observation.
Level 4: partial structural example or bounded proposal.
Level 5: complete explanation, only after explicit learner request or repeated failure.

The system must record which level was used so product experiments can evaluate over-assistance. Higher levels should preserve inspection and learner decision; even a Level 5 explanation must not secretly mutate the program.

## Prediction before execution

When the learner has enough context, Agorix should ask for a lightweight prediction before Run, for example:

- "What do you think your sprite will do first?"
- "How many times do you think this loop will move?"
- "What do you expect to happen when the sprite touches the goal?"

Prediction is used to focus observation, not to grade the child.

## Feedback

Prefer feedback about behavior and evidence:

- "The character moved before the game started."
- "Your loop ran four times."
- "The sprite stopped before touching the goal."

Avoid opaque correctness labels when an explanatory message is possible. If AI provides feedback, it must be framed as a suggestion grounded in available runtime facts, not as hidden authority.

## Anti-over-assistance rules

- Do not produce a complete solution before lower-support scaffolds have been tried, unless the learner explicitly asks after repeated failure.
- Do not change the accepted program for the learner.
- Do not hide the code or the proposal diff.
- Do not claim behavior that the runtime has not observed.
- Do not make mission completion depend on an AI judgment.
- Do not ask for personal data to personalize support.
- Do not turn reflection into a gate that blocks basic completion.

## Completion

Mission completion is deterministic and evaluated by runtime/state, not by an LLM judgment.

## Reflection

After successful execution, ask one short question such as:

- "What made the character start moving?"
- "What would happen if the loop ran twice as many times?"
- "What changed between your first try and the version that worked?"

Reflection is part of learning evidence but must not block basic POC completion.

## Learning evidence and assessment

What Agorix records as evidence of understanding, as opposed to evidence of mission completion, is
specified in [LEARNING_EVIDENCE.md](./LEARNING_EVIDENCE.md) with the executable model in
`packages/learning-evidence`. Two rules from that model apply to this document:

- completion is proven by the deterministic runtime and never implies understanding;
- every piece of evidence carries the assistance level in effect, and understanding credit is
  non-increasing in that level, so a metric cannot reward over-assistance.

## Explicit unresolved decisions

- The exact persistence format for proposal/accept/reject events belongs to later architecture work.
- The exact threshold for escalating from hints to structural proposals should be refined by #70's competency progression and scaffolding rubric.
- Persisting learning evidence beyond a single attempt, and any longitudinal view of it, requires separate approval and a jurisdiction-specific privacy review.
