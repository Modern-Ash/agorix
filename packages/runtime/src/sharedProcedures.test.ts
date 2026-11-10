import { describe, expect, it } from "vitest";
import {
  SCHEMA_VERSION,
  validateProgram,
  type ProjectProgram,
  type Statement,
} from "@agorix/program-model";
import { createWorldState, runMultiActorProgram, runProgram } from "./index.js";

const call = (procedureId: string, args?: readonly number[]): Statement =>
  args === undefined
    ? { type: "callProcedure", procedureId }
    : {
        type: "callProcedure",
        procedureId,
        args: args.map((value) => ({ type: "numericLiteral" as const, value })),
      };

function program(overrides: Partial<ProjectProgram> = {}): ProjectProgram {
  return {
    schema: SCHEMA_VERSION,
    sharedProcedures: [{ id: "shared-1", name: "Salto", body: [{ type: "move", steps: 10 }] }],
    scripts: [
      { id: "a", trigger: { type: "greenFlag" }, statements: [call("shared-1")] },
      { id: "b", trigger: { type: "greenFlag" }, statements: [call("shared-1"), call("shared-1")] },
    ],
    ...overrides,
  };
}

describe("shared custom blocks", () => {
  it("runs the same block for each character that calls it, on that character", () => {
    const actor = (id: string, script: string) => ({
      id,
      name: id,
      x: 0,
      y: 0,
      direction: 0,
      size: 100,
      visible: true,
      scripts: [script],
    });
    const run = runMultiActorProgram(
      program({
        scripts: [
          { id: "a", trigger: { type: "onStart" }, statements: [call("shared-1")] },
          {
            id: "b",
            trigger: { type: "onStart" },
            statements: [call("shared-1"), call("shared-1")],
          },
        ],
      }),
      {
        actors: [actor("actor:a", "a"), actor("actor:b", "b")],
        stage: { actorOrder: ["actor:a", "actor:b"] },
      },
    );
    const x = (id: string) => run.actors.find((actor) => actor.id === id)!.world.sprite.x;
    expect(x("actor:a")).toBe(10);
    expect(x("actor:b")).toBe(20);
  });

  it("takes numbers and may call another shared block", () => {
    const shared = [
      {
        id: "shared-1",
        name: "Doble",
        params: [{ id: "p1" as const, name: "pasos" }],
        body: [{ type: "move" as const, steps: 3 }, call("shared-2")],
      },
      { id: "shared-2", name: "Fin", body: [{ type: "turn" as const, degrees: 90 }] },
    ];
    const run = runProgram(
      program({
        sharedProcedures: shared,
        scripts: [{ id: "a", trigger: { type: "greenFlag" }, statements: [call("shared-1", [4])] }],
      }),
      createWorldState(),
    );
    expect(run.world.sprite.x).toBe(3);
    expect(run.world.sprite.heading).toBe(90);
  });

  it("is refused when a call names no block, when ids repeat, or when a body calls a script's own block", () => {
    expect(() =>
      validateProgram(
        program({
          scripts: [{ id: "a", trigger: { type: "greenFlag" }, statements: [call("nope")] }],
        }),
      ),
    ).toThrow(/INVALID_REFERENCE/);
    expect(() =>
      validateProgram(
        program({
          scripts: [
            {
              id: "a",
              trigger: { type: "greenFlag" },
              statements: [call("shared-1")],
              procedures: [{ id: "shared-1", name: "Otro", body: [{ type: "move", steps: 1 }] }],
            },
          ],
        }),
      ),
    ).toThrow(/DUPLICATE_ID/);
    expect(() =>
      validateProgram(
        program({
          sharedProcedures: [{ id: "shared-1", name: "Mal", body: [call("local-1")] }],
          scripts: [
            {
              id: "a",
              trigger: { type: "greenFlag" },
              statements: [call("local-1")],
              procedures: [{ id: "local-1", name: "Mio", body: [{ type: "move", steps: 1 }] }],
            },
          ],
        }),
      ),
    ).toThrow(/INVALID_REFERENCE/);
  });

  it("stops a shared block that calls itself at the usual depth", () => {
    const loop = runProgram(
      program({
        sharedProcedures: [{ id: "shared-1", name: "Giro", body: [call("shared-1")] }],
        scripts: [{ id: "a", trigger: { type: "greenFlag" }, statements: [call("shared-1")] }],
      }),
      createWorldState(),
    );
    expect(loop.outcome).toBe("budget-exceeded");
  });
});
