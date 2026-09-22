import { SCHEMA_VERSION } from "./schema.js";
import type { ProjectProgram } from "./schema.js";

/**
 * The exact example from docs/architecture/PROGRAMMING_MODEL.md, used to
 * evidence R1 (documented example is valid).
 */
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

/** Exercises every Statement/Expression/Trigger variant at least once. */
export const FULL_COVERAGE_PROGRAM: ProjectProgram = {
  schema: SCHEMA_VERSION,
  scripts: [
    {
      id: "full-coverage",
      trigger: { type: "onStart" },
      statements: [
        { type: "move", steps: 3 },
        { type: "turn", degrees: 90 },
        {
          type: "repeat",
          count: 2,
          body: [{ type: "move", steps: 1 }],
        },
        {
          type: "if",
          condition: { type: "touchingGoal" },
          then: [{ type: "turn", degrees: -90 }],
        },
        {
          type: "if",
          condition: { type: "booleanLiteral", value: true },
          then: [{ type: "move", steps: 0 }],
        },
        {
          type: "if",
          condition: { type: "numericLiteral", value: 42 },
          then: [],
        },
      ],
    },
  ],
};
