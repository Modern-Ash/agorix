# Learning and pedagogy model

## Learning philosophy

Children learn programming concepts by making visible things happen. Every concept must be attached to an observable behavior in a project.

## Concept progression

1. sequence;
2. events;
3. repetition;
4. conditions;
5. state/variables;
6. decomposition/functions;
7. collections and richer abstractions (post-POC).

The POC needs only sequence, events, repetition and simple conditions, but the model must not prevent later growth.

## Challenge structure

Each mission has:
- id/version;
- title and child-facing goal;
- concepts;
- starter project;
- completion predicate;
- optional constraints;
- hint ladder;
- reflection prompt.

## Hint ladder

Level 0: no hint.
Level 1: diagnostic question.
Level 2: concept reminder.
Level 3: point to the relevant program area.
Level 4: partial structural example.
Level 5: complete explanation, only after explicit learner request or repeated failure.

The tutor must record which level was used so product experiments can evaluate whether learners are being over-assisted.

## Feedback

Prefer feedback about behavior:
- “The character moved before the game started.”
- “Your loop never reaches the condition.”

Avoid opaque correctness labels when an explanatory message is possible.

## Completion

Mission completion is deterministic and evaluated by the runtime/state, not by an LLM judgment.

## Reflection

After completion, ask one short question such as:
- “What made the character start moving?”
- “What would happen if the loop ran twice as many times?”

Reflection is part of learning evidence but must not block basic POC completion.
