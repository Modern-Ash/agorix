# POC / MVP scope

Traces to GitHub issues #63, #69, #70 and #71.

## MVP promise

The MVP proves one end-to-end AI-native learning loop:

> AI proposes. Child decides. Runtime proves. Child explains.

The MVP is not complete if AI secretly generates the solution, if code visibility disappears, or if a model claim replaces deterministic runtime evidence.

## Vertical slice

The POC is complete when a learner can finish "First Mission: Reach the goal" using the real editor, canonical program model, visible block/code relationship, deterministic runtime and at least one transparent learning-companion interaction.

## Required learner loop

A learner must be able to:

1. express a simple intent;
2. work with blocks while textual code is always visible;
3. receive at least one bounded AI proposal or scaffold;
4. see exactly what the proposal would change;
5. accept, reject or modify the proposal before it affects the accepted program;
6. run or step through the resulting accepted program;
7. observe deterministic execution evidence;
8. use AI to reason from runtime evidence when behavior is wrong;
9. correct the accepted program;
10. explain one programming concept or change.

## Required experience

### Home / project entry

- create or open a local learner project;
- choose "First Mission";
- enter the editor without account creation, social sharing or classroom setup.

### Editor

- stage/canvas;
- one sprite;
- block toolbox;
- workspace;
- run;
- stop/reset;
- mission panel;
- contextual learning-companion/help panel;
- persistent generated-code panel visible at all times beside or directly below the visual workspace.

The generated-code panel is part of the normal editor surface. It is never an advanced mode, hidden tab or optional export.

### Required blocks

Events:

- when run starts.

Motion:

- move steps;
- turn.

Control:

- repeat N;
- if condition.

Sensing/state:

- touching goal?;
- position X/Y (may remain internal).

### AI-native proposal boundary

The learning companion may ask a clarifying question, point to evidence, propose a bounded structure or explain a concept. Any AI-originated programming suggestion remains a proposal until the learner decides.

Every programming proposal must show:

- what would change;
- which blocks/code region it relates to;
- why it may help;
- that it may be wrong;
- how to accept, reject or modify it.

Hidden AI-generated solutions do not count as MVP success.

### Runtime

- deterministic execution;
- fixed/update loop;
- reset to initial state;
- observable execution state for challenge evaluation;
- runtime evidence usable by the learner and learning companion;
- optional step-through execution if implemented before final MVP evidence.

Mission completion is evaluated by runtime/state, never by an LLM judgment.

### Mission

"Reach the goal"

- starter sprite and goal;
- learner composes behavior;
- deterministic completion predicate;
- progressive hint/proposal ladder;
- prediction prompt where appropriate;
- behavior-specific feedback after failed or surprising runs;
- short reflection prompt after success.

### Persistent code bridge

- generated code is visible at all times while the learner edits blocks;
- every supported block change updates the textual projection immediately;
- the textual projection highlights or otherwise indicates the structure corresponding to the current visual selection where practical;
- render the canonical program into readable Agorix Code or JavaScript/TypeScript-like code for the first POC;
- preserve structural correspondence between block groups and generated text;
- text is read-only for the first POC;
- the learner never needs to switch modes to discover the code behind the visual program.

### Persistence

- browser-local persistence is sufficient for POC;
- versioned project document;
- explicit migration/version failure instead of silent corruption;
- reload retains project state and reproduces consistent block/code state.

## Exit criteria

- Fresh browser session can complete "Reach the goal".
- Learner intent, proposal, accepted program, executed result and reflection are distinguishable in the UI.
- At least one bounded AI proposal is inspectable before it can affect canonical program state.
- Learner can accept, reject or modify the proposal.
- Hidden AI mutation cannot enter the accepted program.
- Blocks and generated code remain visible in the normal learning flow.
- Block program and text projection remain consistent after edit, run, reset and reload.
- Runtime evidence, not AI text, proves behavior and mission completion.
- AI can be disabled/unavailable and the core editor/mission/runtime/reflection path still works.
- Local/open model configuration is supported when hardware/environment permits, and commercial providers remain optional adapters.
- Automated unit/integration tests plus browser E2E cover the vertical slice.
- No provider credential, secret or child PII is required.

## Platform scope

The POC is web/PWA-first, but architecture must preserve direct reuse for mobile and VS Code.

### POC required

- responsive web application;
- no desktop-only assumptions in shared domain packages;
- touch-capable editor interactions where Blockly permits;
- installable PWA baseline only after the AI-native vertical slice is stable enough to package.

### Deferred platform validation

The following remain useful but depend on the canonical program, runtime, editor, AI-native loop and evidence gates being stable:

- Capacitor packaging for Android/iOS using the same web application and shared packages;
- VS Code extension/Webview that can open an Agorix project and render the same canonical program/code relationship.

These future surfaces must not fork the programming model, runtime semantics, curriculum contracts or learning-companion protocol.
