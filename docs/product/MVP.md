# POC / MVP scope

## Vertical slice

The POC is complete when a learner can finish one end-to-end challenge using the real editor and runtime.

## Required experience

### Home / project entry
- create or open a local learner project;
- choose “First Mission”;
- enter editor.

### Editor
- stage/canvas;
- one sprite;
- block toolbox;
- workspace;
- run;
- stop/reset;
- mission panel;
- tutor/help panel;
- optional text-code view.

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

### Runtime
- deterministic execution;
- fixed/update loop;
- reset to initial state;
- observable execution state for challenge evaluation.

### Mission
“Reach the goal”
- starter sprite and goal;
- learner composes behavior;
- deterministic completion predicate;
- at least three progressive hints.

### Text bridge
- render the canonical program into readable JavaScript-like or TypeScript-like code;
- preserve structural correspondence between block groups and generated text;
- text is read-only for first POC.

### Persistence
- browser-local persistence is sufficient for POC;
- versioned project document;
- explicit migration/version failure instead of silent corruption.

## Exit criteria

- fresh browser session can complete the mission;
- reload retains project;
- block program and text projection remain consistent;
- AI tutor can be disabled and core product still works;
- automated unit/integration tests plus one browser E2E cover the vertical slice;
- no secret or child PII is required.
