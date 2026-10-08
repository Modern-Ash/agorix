import { SCHEMA_VERSION, type ProjectProgram } from "@agorix/program-model";

/** Exact documented example from docs/architecture/PROGRAMMING_MODEL.md. */
export const DOCUMENTED_EXAMPLE_PROGRAM: ProjectProgram = {
  schema: SCHEMA_VERSION,
  scripts: [
    {
      id: "main",
      trigger: { type: "onStart" },
      statements: [
        {
          type: "repeat",
          count: 5,
          body: [{ type: "move", steps: 10 }],
        },
      ],
    },
  ],
};

/** Every Statement/Expression/Trigger variant at least once, plus nesting. */
export const FULL_COVERAGE_PROGRAM: ProjectProgram = {
  schema: SCHEMA_VERSION,
  scripts: [
    {
      id: "full-coverage",
      trigger: { type: "onStart" },
      statements: [
        { type: "move", steps: 3 },
        { type: "turn", degrees: 90 },
        { type: "say", text: "Launch sequence" },
        { type: "think", text: "Need a better route" },
        { type: "hide" },
        { type: "show" },
        { type: "setSize", size: 120 },
        { type: "switchCostume", costumeId: "asset:costume.default" },
        { type: "switchBackdrop", backdropId: "asset:space.trailhead" },
        { type: "playSound", soundId: "asset:sound.beacon" },
        { type: "stopSounds" },
        { type: "broadcast", message: "mission:check" },
        {
          type: "repeat",
          count: 2,
          body: [
            { type: "move", steps: 1 },
            {
              type: "if",
              condition: { type: "touchingGoal" },
              then: [{ type: "turn", degrees: -90 }],
            },
          ],
        },
        {
          type: "if",
          condition: { type: "booleanLiteral", value: true },
          then: [{ type: "move", steps: 0 }],
        },
        {
          type: "if",
          condition: { type: "booleanLiteral", value: false },
          then: [],
        },
        {
          type: "if",
          condition: { type: "numericLiteral", value: 42 },
          then: [],
        },
      ],
    },
    {
      id: "key-trigger",
      trigger: { type: "onKeyPressed", key: "ArrowRight" },
      statements: [{ type: "move", steps: 4 }],
    },
    {
      id: "click-trigger",
      trigger: { type: "onActorClicked" },
      statements: [{ type: "say", text: "Clicked" }],
    },
    {
      id: "message-trigger",
      trigger: { type: "onMessage", message: "mission:check" },
      statements: [{ type: "think", text: "Checking" }],
    },
  ],
};

/** Empty statement list / empty if.then edge cases. */
export const EMPTY_EDGE_PROGRAM: ProjectProgram = {
  schema: SCHEMA_VERSION,
  scripts: [
    {
      id: "empty",
      trigger: { type: "onStart" },
      statements: [{ type: "if", condition: { type: "booleanLiteral", value: true }, then: [] }],
    },
    {
      id: "empty-body",
      trigger: { type: "onStart" },
      statements: [],
    },
  ],
};
