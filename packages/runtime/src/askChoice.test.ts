import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, validateProgram, type ProjectProgram } from "@agorix/program-model";
import { createWorldState, runMultiActorProgram, runProgram } from "./index.js";

const program: ProjectProgram = {
  schema: SCHEMA_VERSION,
  variables: [{ id: "answer", name: "Choice", initialValue: 0, visible: true }],
  scripts: [
    {
      id: "s",
      trigger: { type: "greenFlag" },
      statements: [
        { type: "askChoice", promptId: "path", variableId: "answer" },
        { type: "move", steps: 20 },
      ],
    },
  ],
};

describe("askChoice", () => {
  it("pauses at a bundled prompt without mutating the answer or running later blocks", () => {
    const result = runProgram(program, createWorldState());
    expect(result.outcome).toBe("stopped");
    expect(result.trace.map((entry) => entry.statementType)).toEqual(["askChoice"]);
    expect(result.trace[0]?.note).toBe("askChoice: awaiting path");
    expect(result.world.variables?.answer?.value).toBe(0);
    expect(result.world.sprite.x).toBe(createWorldState().sprite.x);
  });

  it("continues deterministically with the selected 1-based option index", () => {
    const input = { choices: { path: 2 } };
    const result = runProgram(program, createWorldState(), input);
    expect(result.outcome).toBe("completed");
    expect(result.world.variables?.answer?.value).toBe(2);
    expect(result.world.sprite.x).toBe(createWorldState().sprite.x + 20);
    expect(runProgram(program, createWorldState(), input)).toEqual(result);
    expect(result.trace[0]?.note).toBeUndefined();
  });

  it("refuses invalid indices and unbundled prompt or variable ids", () => {
    for (const choice of [0, 3, 1.5, Number.NaN]) {
      expect(runProgram(program, createWorldState(), { choices: { path: choice } }).outcome).toBe(
        "stopped",
      );
    }
    expect(() =>
      validateProgram({
        ...program,
        scripts: [
          {
            ...program.scripts[0]!,
            statements: [{ type: "askChoice", promptId: "free text", variableId: "answer" }],
          },
        ],
      }),
    ).toThrow();
    expect(() =>
      validateProgram({
        ...program,
        scripts: [
          {
            ...program.scripts[0]!,
            statements: [{ type: "askChoice", promptId: "path", variableId: "missing" }],
          },
        ],
      }),
    ).toThrow();
  });

  it("pauses the scene again at a second prompt and continues only after both choices", () => {
    const twoQuestions: ProjectProgram = {
      ...program,
      scripts: [
        {
          ...program.scripts[0]!,
          statements: [
            { type: "askChoice", promptId: "path", variableId: "answer" },
            { type: "askChoice", promptId: "shape", variableId: "answer" },
            { type: "move", steps: 20 },
          ],
        },
      ],
    };
    const first = runMultiActorProgram(twoQuestions, {}, { choices: { path: 1 } });
    expect(first.outcome).toBe("stopped");
    expect(first.trace.at(-1)?.note).toBe("askChoice: awaiting shape");
    expect(first.trace.map((entry) => entry.statementType)).toEqual(["askChoice", "askChoice"]);
    const finished = runMultiActorProgram(twoQuestions, {}, { choices: { path: 1, shape: 3 } });
    expect(finished.outcome).toBe("completed");
    expect(finished.actors[0]!.world.variables?.answer?.value).toBe(3);
  });
});
