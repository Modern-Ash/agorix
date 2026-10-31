import { describe, expect, it } from "vitest";
import {
  SCHEMA_VERSION,
  type ProjectCreativeState,
  type ProjectProgram,
} from "@agorix/program-model";
import { runMultiActorProgram } from "./index.js";

const creative: ProjectCreativeState = {
  actors: [
    {
      id: "a",
      name: "A",
      x: 0,
      y: 0,
      direction: 0,
      size: 100,
      visible: true,
      scripts: ["stopper", "later-a"],
    },
    {
      id: "b",
      name: "B",
      x: 0,
      y: 0,
      direction: 0,
      size: 100,
      visible: true,
      scripts: ["later-b"],
    },
  ],
  stage: { actorOrder: ["a", "b"] },
};

describe("stop scopes", () => {
  for (const [scope, expected] of [
    ["script", ["stop", "move", "move"]],
    ["actor", ["stop", "move"]],
    ["scene", ["stop"]],
  ] as const) {
    it(`${scope} stops only its declared scope and leaves a trace`, () => {
      const program: ProjectProgram = {
        schema: SCHEMA_VERSION,
        scripts: [
          {
            id: "stopper",
            trigger: { type: "onStart" },
            statements: [
              { type: "stop", scope },
              { type: "move", steps: 100 },
            ],
          },
          {
            id: "later-a",
            trigger: { type: "onStart" },
            statements: [{ type: "move", steps: 10 }],
          },
          {
            id: "later-b",
            trigger: { type: "onStart" },
            statements: [{ type: "move", steps: 20 }],
          },
        ],
      };
      const result = runMultiActorProgram(program, creative);
      expect(result.outcome).toBe("stopped");
      expect(result.trace.map((entry) => entry.statementType)).toEqual(expected);
      expect(result.trace[0]?.stopScope).toBe(scope);
      expect(result.actors.map((actor) => actor.world.sprite.x)).toEqual(
        scope === "script" ? [10, 20] : scope === "actor" ? [0, 20] : [0, 0],
      );
    });
  }
});
