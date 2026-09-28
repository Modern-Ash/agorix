# Product Intent - Agorix

## Vision

Agorix is an open-source, AI-native programming learning environment for children. It combines creative block programming, continuously visible textual code, deterministic runtime evidence and a transparent learning companion so children can build programs in the era of AI without giving up authorship.

The north star is:

> AI proposes. Child decides. Runtime proves. Child explains.

The non-negotiable product rule is:

> Nothing happens under the rug.

AI is not a hidden implementer and not merely a chatbot for when the learner is stuck. It is a visible scaffold inside the learning loop: it may ask clarifying questions, decompose intent, propose bounded structures, explain runtime evidence and challenge the learner to reflect. The learner inspects, accepts, changes or rejects every AI-originated programming proposal before it can affect the accepted program.

## Primary learner

POC target: children approximately 8-14 years old with no required previous programming experience.

The product must still be usable by an older beginner. Age must not be encoded as a hard technical limitation.

## Core job to be done

> I want to make something move, react and behave the way I imagined, understand the programming idea that made it work, and know what I decided versus what AI only suggested.

## Product promise

A first-time learner can:

1. open a local project;
2. see a stage, a character, blocks and the code behind the blocks;
3. express what they want the program to do;
4. receive clarifying or decomposing questions when that helps learning;
5. inspect any AI proposal as a proposal, not as a hidden change;
6. accept, modify or reject the proposal;
7. keep blocks and textual code visible while editing;
8. predict what the program will do when appropriate;
9. run the program and observe deterministic runtime evidence;
10. debug from behavior and runtime facts, with AI scaffolding when useful;
11. improve the program by experimentation;
12. explain what changed and why it works.

## POC success moment

The learner completes the mission "reach the goal" using event plus movement/control blocks. During the loop, the learner sees the code behind the blocks, runs the program, encounters at least one incomplete or surprising result, uses behavior-specific feedback or a bounded learning-companion suggestion, changes the accepted program themselves, reaches the deterministic completion predicate and answers a short reflection prompt about why the program works.

## Differentiators to validate

- One canonical program can be viewed as blocks and as readable text.
- The transition to text is gradual and continuously visible, not a separate advanced mode.
- AI support is transparent scaffolding: proposals are inspectable and learner-controlled.
- The product distinguishes AI proposal, accepted program and executed result.
- Deterministic runtime evidence outranks AI claims about what happened.
- Mistakes and failed predictions are treated as learning material.
- Challenges teach concepts through creation, prediction, execution, observation and explanation.
- Free-play remains available after guided work.
- Core learning works when AI is disabled or unavailable.
- AI/provider/model choices are interchangeable implementation details, not product dependencies.

## Product invariants

- The learner creates; AI assists, proposes and explains.
- No AI-originated code or program mutation is hidden from the learner.
- The learner must inspect and decide before an AI proposal becomes part of the accepted program.
- The runtime is the objective authority for program behavior and mission completion.
- Blocks and generated textual code stay visible in the normal learning flow.
- Generated text in the POC is learning output and is not the executed source of truth.
- Child safety and privacy constraints override engagement, personalization and AI convenience.
- Provider independence is required: no product behavior may require a specific LLM provider.

## Non-goals for POC

- public social network;
- classroom administration;
- payments/subscriptions;
- native mobile apps;
- multiplayer;
- hardware/robotics integration;
- full curriculum;
- production-scale moderation;
- arbitrary user code execution on a server;
- invisible AI code generation;
- mission completion by LLM judgment;
- choosing or privileging a specific LLM provider.

## Explicit unresolved decisions

- The exact UI treatment for comparing an AI proposal with the accepted program is deferred to the transparency UX and architecture issues.
- The long-term boundary between "AI tutor" naming and broader "learning companion" capability naming should be reconciled in #72 so architecture and package names do not drift.
- Multi-language learning scope is acknowledged by the epic, but this issue does not choose language-pack order or implementation.
