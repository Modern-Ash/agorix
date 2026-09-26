# Agorix

> **Open-source, AI-native creative coding for children.**
>
> **AI proposes. Child decides. Runtime proves. Child explains.**
>
> **Nothing happens under the rug.**

Agorix is a programming learning environment for children designed for the era of AI.

It is not intended to be “Scratch plus a chatbot”, and it is not a code generator that hides implementation behind an assistant. Agorix teaches children to **think, build, inspect, test, debug and explain programs while collaborating with AI**.

The learner remains the author.

AI may ask, explain, challenge, propose or help diagnose. It must not silently own the solution.

The program remains visible. The learner decides what enters it. A deterministic runtime executes it. Observable evidence shows what actually happened.

---

## Why Agorix

Programming education is changing.

A child learning today should still understand sequence, events, loops, conditions, state, functions and debugging. But they should also learn how to work critically with AI:

- how to express intent;
- how to decompose a problem;
- how to inspect an AI proposal;
- how to decide whether to accept, modify or reject it;
- how to test what AI suggested;
- how to distinguish a confident answer from actual evidence;
- how to compare alternative solutions;
- how to explain why a program works.

Agorix treats these as **programming skills**, not as a separate “prompt engineering” course.

The product goal is not to help a child finish code as quickly as possible.

The goal is to help the child understand what is being built and progressively become more autonomous.

---

## North star

A successful Agorix learning experience looks like this:

```text
             CHILD
               |
               v
      What do I want to build?
               |
               v
        Express intention
               |
               v
          Child <-> AI
               |
       ask / plan / propose
               |
               v
      inspect and decide
               |
               v
        Blocks <-> Code
               |
        predict behavior
               |
               v
             Run
               |
               v
      observable execution
               |
        +------+------+
        |             |
      works         differs
        |             |
        v             v
     explain      investigate
        |         child + AI
        +------+------+
               |
               v
            improve
               |
               v
            reflect
```

The AI is part of the learning process, but not the authority.

---

## Four rules that define Agorix

### 1. AI proposes. Child decides.

AI-generated changes are proposals.

A provider response must never silently mutate the learner's program.

The expected path is:

```text
AI structured proposal
        |
        v
    validation
        |
        v
 preview + explanation + diff
        |
   +----+-----+
   |    |     |
accept edit reject
   |          |
   v          v
canonical   unchanged
 program     program
```

The learner should be able to answer:

- What is AI proposing?
- What will change?
- Why is it suggesting this?
- Do I want to use it?

### 2. Runtime proves.

An LLM does not decide whether the program works.

Agorix executes the canonical program deterministically and produces observable runtime facts.

```text
AI suggestion
     |
     v
accepted canonical program
     |
     v
validator
     |
     v
deterministic runtime
     |
     v
execution evidence
```

The model can help interpret that evidence. It cannot replace it.

### 3. Child explains.

Completion is not the only learning signal.

The learner should progressively be able to answer questions such as:

- What made the character move?
- Why did the loop repeat?
- What happened when the condition was false?
- What was wrong with the original AI proposal?
- Why does the corrected version work?

### 4. Nothing happens under the rug.

There should be no “magic” programming path.

The learner must be able to see what program exists, what changed, what instruction is executing and what happened because of that instruction.

---

## Code is always visible

Agorix deliberately avoids treating textual code as a hidden “advanced mode”.

Visual programming and textual programming are synchronized views over **one canonical program**.

```text
                 Canonical Program
                        |
       +----------------+----------------+
       |                |                |
       v                v                v
     Blocks        Agorix Code         Python
                                      TypeScript
                                         Lua...
```

The learner is not expected to understand every syntax detail on day one.

But the code should be visible from the beginning so that programming is never presented as an invisible mechanism behind colored blocks.

A block such as:

```text
repeat 4
    move 10
    turn 90
```

can progressively be seen as Agorix Code:

```text
al iniciar
    repetir 4 veces
        mover 10
        girar 90
```

then Python:

```python
for _ in range(4):
    move(10)
    turn(90)
```

and TypeScript:

```typescript
for (let i = 0; i < 4; i++) {
    move(10);
    turn(90);
}
```

These are not separate programs.

They are different representations of the same program.

---

## Progressive multi-language learning

Agorix is designed around the idea that:

> **The programming concept is more fundamental than the language syntax used to express it.**

The intended progression is:

```text
Blocks
   |
   v
Agorix Code
   |
   v
Python
   |
   v
TypeScript / JavaScript
   |
   v
additional language packs
```

### Agorix Code

Agorix Code is the planned child-friendly textual projection.

Its purpose is to reduce early syntax load while preserving real programming structure:

- sequence;
- nesting;
- repetition;
- decisions;
- state;
- decomposition.

It is inspired by gradual-programming approaches such as [Hedy](https://www.hedy.org/), while remaining an Agorix-specific projection over the canonical program.

### Python first

Python is the planned first conventional textual language because it provides a relatively direct bridge from structured educational code to general-purpose programming.

### TypeScript second

TypeScript is a second primary projection and also aligns naturally with the Agorix implementation stack.

### Language packs

The architecture should allow later projections such as Lua and other community-contributed languages without modifying canonical program semantics.

The multi-language roadmap is tracked in epic [#65](https://github.com/Modern-Ash/agorix/issues/65).

---

## Observable execution

Seeing source code is only part of transparency.

The learner should also be able to see **execution**.

Agorix is moving toward:

- Run;
- Stop;
- Reset;
- **Step**;
- synchronized block highlighting;
- synchronized code highlighting;
- child-readable execution traces;
- relevant before/after state.

For example:

```text
Instruction: move 10

Before:
x = 20

After:
x = 30

Visible result:
the character moved right
```

This builds the causal model:

```text
instruction
    |
    v
execution
    |
    v
state change
    |
    v
visible behavior
```

AI debugging must reason from these runtime observations instead of inventing execution facts.

This work is tracked in epic [#64](https://github.com/Modern-Ash/agorix/issues/64).

---

## Pedagogy before automation

Agorix is an educational product first.

A feature is not automatically valuable because an LLM can perform it.

The relevant question is:

> **What does the learner understand better because this capability exists?**

### Learn by making

Programming concepts should produce observable behavior.

Instead of beginning with a lecture about loops, Agorix can create a need for repetition and help the learner discover the abstraction.

### Progressive scaffolding

AI assistance should increase only as needed.

A typical progression may be:

```text
1. diagnostic question
2. concept reminder
3. point to the relevant program area
4. structural hint
5. partial example
6. complete explanation when pedagogically justified
```

The provider must not be free to jump directly to a complete solution when the current pedagogical policy forbids it.

### Mistakes are learning material

Agorix should not optimize mistakes away.

A failed execution creates evidence that can be inspected.

Instead of:

> “Change 3 to 5.”

Agorix should prefer interactions such as:

> “The move instruction ran three times and the character stopped before the goal. What could we change?”

### Prediction and reflection

Learners should sometimes predict before running and explain after running.

This helps turn code execution into reasoning rather than trial-and-error clicking.

The pedagogical re-foundation is tracked in epic [#63](https://github.com/Modern-Ash/agorix/issues/63).

---

## AI Learning Companion

The current tutor concept is evolving into a broader, provider-neutral **Learning Companion**.

A single configured model may support multiple pedagogical capabilities.

| Role | Purpose |
| --- | --- |
| **Coach** | Ask questions and scaffold thinking |
| **Builder** | Propose bounded program structures |
| **Debugger** | Reason from deterministic runtime evidence |
| **Explainer** | Explain code and concepts |
| **Challenger** | Ask the learner to predict, compare or justify |
| **Reflector** | Help the learner explain what was learned |

These are roles, not necessarily separate agents or separate models.

The companion must remain constrained by product and pedagogical policy.

It does not receive authority merely because it is an LLM.

The Learning Companion roadmap is tracked in epic [#66](https://github.com/Modern-Ash/agorix/issues/66).

---

## AI literacy is part of programming literacy

Agorix should teach children that:

- AI can be wrong;
- fluent language is not proof;
- a suggestion needs to be inspected;
- code needs to be tested;
- different models may suggest different solutions;
- the runtime provides stronger evidence about execution than model confidence;
- the learner remains responsible for the final decision.

An advanced activity may deliberately compare two different AI proposals and ask the learner to predict and test them.

The goal is not to create a model leaderboard.

The goal is to teach:

```text
proposal
   |
   v
prediction
   |
   v
experiment
   |
   v
evidence
   |
   v
conclusion
```

This work is tracked in epic [#68](https://github.com/Modern-Ash/agorix/issues/68).

---

## Open source by design

Agorix is intended to be an open-source project, not a closed educational surface around a proprietary AI service.

The project aims for:

- auditable source code;
- auditable pedagogical rules;
- visible learning contracts;
- inspectable AI integration boundaries;
- community-extensible curriculum;
- community-extensible language packs;
- community-extensible provider adapters;
- self-hosting where practical.

The repository license and contribution/governance model are being formalized in [#73](https://github.com/Modern-Ash/agorix/issues/73). Until that work is merged, do not infer a license solely from this README.

---

## Open-source-first and multi-LLM

Agorix should not depend on a single AI vendor.

The architecture direction is:

```text
               Learning Companion
                       |
             provider-neutral contract
                       |
       +---------------+---------------+
       |               |               |
       v               v               v
   local/open      compatible       commercial
     models         gateways         providers
       |               |               |
     Ollama       llama.cpp/vLLM      optional
                  compatible APIs      adapters
```

Priorities:

1. provider-neutral contracts;
2. deterministic fake provider for CI/tests;
3. local/open models where practical;
4. OpenAI-compatible interoperability gateways for local/open inference servers;
5. optional commercial providers behind the same boundary;
6. capability negotiation instead of vendor assumptions.

A commercial provider may offer stronger capabilities for a particular task.

That does not make the provider part of Agorix's domain model.

The multi-provider roadmap is tracked in epic [#67](https://github.com/Modern-Ash/agorix/issues/67).

---

## Architecture

The existing Agorix architecture already contains much of the foundation required for this direction.

```text
                           Learner
                              |
              +---------------+---------------+
              |                               |
              v                               v
         Visual editor                  Learning Companion
              |                               |
              v                               v
        Canonical Program <---- ProgramProposal boundary
              |
      +-------+---------+----------------+
      |                 |                |
      v                 v                v
  block adapter    LanguageProjection   validator
                        |                |
              +---------+------+         v
              |         |      |       runtime
              v         v      v         |
         Agorix Code  Python   TS         v
                                      observations
                                          |
                            +-------------+-------------+
                            |                           |
                            v                           v
                       stage/UI                 AI debugging context
```

### Canonical program

The canonical program is the programming source of truth.

Blockly is not the domain model.

A textual language projection is not the domain model.

An LLM response is not the domain model.

### Deterministic runtime

The runtime executes canonical semantics without `eval`, arbitrary generated JavaScript or provider-generated executable code.

### LanguageProjection

All textual representations should be deterministic projections over canonical state with stable canonical-node-to-text mappings.

### ProgramProposal

AI-generated changes should enter through a structured proposal boundary, be validated and previewed, and require an explicit learner decision before canonical mutation.

### Runtime observations

Objective execution facts can support:

- mission completion;
- highlighting;
- child-readable traces;
- debugging;
- AI grounding;
- learning evidence.

---

## Product surfaces

Agorix is TypeScript-first and currently targets:

- Web / PWA as the reference surface;
- Android / iOS through Capacitor after the core learning model is stable;
- VS Code extension as a later portability/advanced-learning proof.

The architecture should share canonical program, runtime, curriculum, projections and learning contracts across surfaces.

Broad platform expansion must not take priority over validating the AI-native pedagogical loop.

---

## Current roadmap

The AI-native product re-foundation is organized as six executable epics:

| Epic | Focus |
| --- | --- |
| [#63](https://github.com/Modern-Ash/agorix/issues/63) | AI-native product and pedagogical re-foundation |
| [#64](https://github.com/Modern-Ash/agorix/issues/64) | Transparent programming and observable execution |
| [#65](https://github.com/Modern-Ash/agorix/issues/65) | Progressive multi-language code learning |
| [#66](https://github.com/Modern-Ash/agorix/issues/66) | AI-native Learning Companion and governed collaboration |
| [#67](https://github.com/Modern-Ash/agorix/issues/67) | Open-source-first multi-LLM provider architecture |
| [#68](https://github.com/Modern-Ash/agorix/issues/68) | AI literacy, child safety and learning evidence |

Each epic contains child issues with dependencies, acceptance criteria and evidence requirements.

Existing implementation is not being discarded. The canonical model, runtime, observations, editor, block adapter, initial code generator, mission system and persistence are inputs to this next phase.

---

## Built with Agora AI-SDLC

Agorix is also a real-world consumer and proving ground for [Agora AI-SDLC](https://github.com/Modern-Ash/agora-ai-sdlc).

GitHub issues are the executable work queue.

Product intent, architecture, plans, decisions, evidence and review should live in durable repository artifacts rather than private chat history.

Different agents can execute bounded work under the same contracts.

Examples may include:

- Claude / Claude Code;
- OpenAI Codex;
- OpenCode;
- Ollama-backed/local agents;
- other compatible runtimes.

No agent or provider is the architecture authority.

Agora governs the workflow. Repository artifacts govern the product. Runtime evidence governs execution facts.

### Starting an issue

From a repository configured with Agora AI-SDLC:

```bash
aisdlc start --issue <issue-number> --agent <runtime>
```

The assigned agent should:

1. read the issue;
2. read every referenced source-of-truth document;
3. create required artifacts;
4. implement only approved scope;
5. add deterministic tests;
6. collect evidence;
7. open a linked PR;
8. obtain independent review;
9. never self-merge.

See:

- [AGENTS.md](AGENTS.md)
- [AI-SDLC setup](docs/delivery/AI_SDLC_SETUP.md)
- [Agentic development model](docs/delivery/AGENTIC_DEVELOPMENT.md)

---

## Developer bootstrap

Prerequisites:

- Node 22 — see `.nvmrc`;
- pnpm 9 through Corepack.

```bash
git clone https://github.com/Modern-Ash/agorix.git
cd agorix

corepack enable
pnpm install

pnpm dev --filter @agorix/web
pnpm lint
pnpm test
pnpm build
pnpm run verify
```

`pnpm run verify` performs a frozen install plus lint, tests and build with one exit code.

---

## Repository layout

```text
apps/
  web/              React + Vite reference UI
  tutor-api/        Current server-side AI boundary; evolving toward Learning Companion API
  mobile/           Capacitor packaging boundary

extensions/
  vscode/           VS Code extension boundary

packages/
  program-model/    Canonical serializable program
  block-editor/     Blockly adapter
  runtime/          Deterministic interpreter
  stage/            Platform-neutral stage state
  code-generator/   Current textual projection; evolving to LanguageProjection
  curriculum/       Missions and learning content
  tutor-contract/   Current tutor contract; evolving to LearningCompanion
  persistence/      Versioned project storage
  platform-contract/ Platform capability boundary
```

Domain packages must not import React, Blockly, Phaser, Capacitor, VS Code APIs or provider SDKs unless the package is explicitly an adapter boundary intended for that dependency.

---

## Safety and privacy

Agorix is designed for children, so safety constraints are architectural.

Core expectations include:

- no name, school, address, exact location or contact data required to learn programming;
- no public chat/DM/social network in the current scope;
- no provider secret in browser/client bundles;
- raw child free text is not logged by default;
- remote providers receive only the context required for the requested capability;
- local/offline operation should be possible where practical;
- malformed AI output fails closed;
- AI-generated source text is never executed as arbitrary code simply because a model returned it;
- deterministic runtime and validators remain security boundaries.

---

## Design references

Agorix is not a clone, but it learns from strong ideas in existing educational tools:

- [Scratch](https://scratch.mit.edu/) — creative, immediate visual programming;
- [Blockly](https://developers.google.com/blockly) — visual programming infrastructure and language generation;
- [Microsoft MakeCode](https://www.microsoft.com/makecode) — blocks/text bridging;
- [Hedy](https://www.hedy.org/) — gradual textual programming and reduced early syntax load.

Agorix combines these inspirations with a different central question:

> **How should children learn programming when AI can already propose code?**

Our answer is not to hide more.

It is to make the collaboration, the program and the execution **more visible**.

---

## The short version

Agorix teaches children to program with AI without turning programming into magic.

```text
AI proposes.
Child decides.
Code stays visible.
Runtime executes.
Evidence shows what happened.
Child explains.
```

That is the product.
