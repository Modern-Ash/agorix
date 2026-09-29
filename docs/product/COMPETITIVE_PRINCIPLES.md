# Competitive principles

Agorix does not clone another product. It combines familiar learning surfaces with a distinct transparent AI-native loop:

> AI proposes. Child decides. Runtime proves. Child explains.

## Comparison categories

### Block-first creative environments

Examples in this category prioritize creative immediacy: sprites, stages, event-driven scripts, quick feedback and playful remixing.

Agorix retains:

- sprites/actors on a stage;
- event-driven visual scripts;
- immediate run/stop/reset feedback;
- creative stories and games.

Agorix differs because the learner also sees the textual code behind the blocks during normal editing and can inspect AI-originated proposals before any change enters the accepted program.

### Block-to-text environments

Examples in this category help learners move between visual blocks and textual languages.

Agorix retains:

- one canonical program represented visually and textually;
- gradual exposure to text;
- stable correspondence between visual structure and text.

Agorix differs because text visibility is an invariant, not a separate reveal mode, and the bridge is tied to runtime evidence and AI-literacy behaviors.

### Coding tools with chat assistants

Examples in this category let a user ask a model for help, code or explanation.

Agorix retains:

- contextual help;
- suggestions grounded in the current task and program;
- optional provider-backed assistance.

Agorix differs because AI is not the authoring authority. AI output is a bounded proposal, explanation or scaffold. The learner must inspect and decide, and runtime evidence is stronger than confident language.

### Transparent AI-native learning loop

Agorix's distinctive loop is:

```text
learner intent
  -> clarifying question or bounded proposal
  -> visible proposal/diff
  -> learner accept / reject / modify
  -> accepted canonical program
  -> visible blocks + code
  -> deterministic runtime evidence
  -> evidence-grounded debugging
  -> learner explanation
```

This is the product being tested. A hidden model-generated solution is a failure, even if the sprite reaches the goal.

## Agorix decisions

1. Start with one polished creation loop, not a content catalog.
2. The canonical program model is independent from Blockly, React, Phaser and any LLM provider.
3. Blocks and generated code are projections of the same canonical program.
4. Code visibility is invariant during normal learning.
5. Learning-companion intervention has levels: diagnostic question, concept reminder, relevant surface/evidence pointer, bounded proposal, complete explanation only after repeated failure or explicit learner request.
6. AI proposals must be previewed and learner-controlled before mutation.
7. Runtime evidence, not AI language, proves behavior.
8. Text is initially read-only in the POC unless bidirectional editing proves inexpensive and safe.
9. No public sharing until child-safety and moderation are designed explicitly.
10. Provider/model choices are adapters, not product foundations.

## What not to optimize for

- Feature breadth before the AI-native learner loop works.
- A generic chat panel that bypasses proposal inspection.
- Provider-specific prompt tricks.
- Platform packaging before the web vertical slice proves the learning model.
- Completion metrics that reward AI solving before the learner reasons.
