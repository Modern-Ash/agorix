import { describe, expect, it } from "vitest";
import {
  SCHEMA_VERSION,
  type ProjectCreativeState,
  type ProjectProgram,
  type Statement,
} from "@agorix/program-model";
import { createWorldState, runMultiActorProgram, runProgram } from "./index.js";

const program = (statements: Statement[]): ProjectProgram => ({
  schema: SCHEMA_VERSION,
  scripts: [{ id: "main", trigger: { type: "onStart" }, statements }],
});

describe("heading motion", () => {
  it("points in a direction and moves along it", () => {
    const result = runProgram(
      program([
        { type: "pointInDirection", degrees: 90 },
        { type: "move", steps: 10 },
      ]),
      createWorldState(),
    );
    expect(result.outcome).toBe("completed");
    expect(result.world.sprite.heading).toBe(90);
    expect(result.world.sprite.x).toBe(0);
    expect(result.world.sprite.y).toBe(10);
    expect(result.trace.map((entry) => entry.statementType)).toEqual(["pointInDirection", "move"]);
  });

  it("normalizes a negative direction", () => {
    const result = runProgram(
      program([{ type: "pointInDirection", degrees: -90 }]),
      createWorldState(),
    );
    expect(result.world.sprite.heading).toBe(270);
  });

  it("bounces off the right edge and keeps the sprite inside the stage", () => {
    const world = createWorldState({ sprite: { x: 310, y: 0, heading: 0 } });
    const result = runProgram(
      program([{ type: "move", steps: 40 }, { type: "bounceOnEdge" }]),
      world,
    );
    expect(result.world.sprite.x).toBe(320);
    expect(result.world.sprite.heading).toBe(180);
  });

  it("bounces off the top edge with a diagonal heading", () => {
    const world = createWorldState({ sprite: { x: 100, y: 115, heading: 45 } });
    const result = runProgram(
      program([{ type: "move", steps: 20 }, { type: "bounceOnEdge" }]),
      world,
    );
    expect(result.world.sprite.y).toBe(120);
    expect(result.world.sprite.heading).toBe(315);
  });

  it("leaves heading and position alone when not on an edge", () => {
    const world = createWorldState({ sprite: { x: 100, y: 0, heading: 30 } });
    const result = runProgram(program([{ type: "bounceOnEdge" }]), world);
    expect(result.world.sprite).toMatchObject({ x: 100, y: 0, heading: 30 });
  });

  it("points towards another actor using positions at activation time", () => {
    const creative: ProjectCreativeState = {
      actors: [
        {
          id: "actor:a",
          name: "A",
          x: 0,
          y: 0,
          direction: 0,
          size: 100,
          visible: true,
          scripts: ["a"],
        },
        {
          id: "actor:b",
          name: "B",
          x: 0,
          y: 50,
          direction: 0,
          size: 100,
          visible: true,
          scripts: [],
        },
      ],
      stage: { actorOrder: ["actor:a", "actor:b"] },
    };
    const run = () =>
      runMultiActorProgram(
        {
          schema: SCHEMA_VERSION,
          scripts: [
            {
              id: "a",
              trigger: { type: "onStart" },
              statements: [{ type: "pointTowards", actorId: "actor:b" }],
            },
          ],
        },
        creative,
      );
    const result = run();
    expect(result.actors[0]?.world.sprite.heading).toBe(90);
    expect(JSON.stringify(run())).toBe(JSON.stringify(result));
  });

  it("ignores pointTowards for a missing or identical target", () => {
    const result = runProgram(
      program([{ type: "pointTowards", actorId: "actor:missing" }]),
      createWorldState({ sprite: { x: 0, y: 0, heading: 30 } }),
    );
    expect(result.outcome).toBe("completed");
    expect(result.world.sprite.heading).toBe(30);
  });
});

describe("repeatUntil", () => {
  const xAbove = (value: number) =>
    ({
      type: "greaterThan",
      left: { type: "xPosition" },
      right: { type: "numericLiteral", value },
    }) as const;

  it("repeats the body until the condition holds, checking before each pass", () => {
    const result = runProgram(
      program([
        { type: "repeatUntil", condition: xAbove(100), body: [{ type: "move", steps: 40 }] },
      ]),
      createWorldState(),
    );
    expect(result.outcome).toBe("completed");
    expect(result.world.sprite.x).toBe(120);
    expect(result.notes).toBeUndefined();
  });

  it("does not run the body when the condition already holds", () => {
    const result = runProgram(
      program([
        { type: "repeatUntil", condition: xAbove(-1), body: [{ type: "move", steps: 40 }] },
      ]),
      createWorldState(),
    );
    expect(result.world.sprite.x).toBe(0);
  });

  it("stops after 100 passes when the condition never holds and says so", () => {
    const result = runProgram(
      program([
        { type: "repeatUntil", condition: xAbove(1e6), body: [{ type: "move", steps: 1 }] },
      ]),
      createWorldState(),
    );
    expect(result.outcome).toBe("completed");
    expect(result.world.sprite.x).toBe(100);
    expect(result.notes?.[0]).toContain("repeatUntil");
  });

  it("ends a bounce loop when the sprite reaches the left edge sensor", () => {
    const result = runProgram(
      program([
        { type: "pointInDirection", degrees: 180 },
        {
          type: "repeatUntil",
          condition: { type: "touchingStageEdge", minX: 0, maxX: 320, minY: -100, maxY: 120 },
          body: [{ type: "move", steps: 20 }],
        },
      ]),
      createWorldState({ sprite: { x: 100, y: 0, heading: 0 } }),
    );
    expect(result.world.sprite.x).toBeLessThanOrEqual(12);
  });
});

describe("repeatUntil with several actors", () => {
  it("delivers a broadcast sent from inside the loop body", () => {
    const creative: ProjectCreativeState = {
      actors: [
        {
          id: "actor:a",
          name: "A",
          x: 0,
          y: 0,
          direction: 0,
          size: 100,
          visible: true,
          scripts: ["a"],
        },
        {
          id: "actor:b",
          name: "B",
          x: 0,
          y: 0,
          direction: 0,
          size: 100,
          visible: true,
          scripts: ["b"],
        },
      ],
      stage: { actorOrder: ["actor:a", "actor:b"] },
    };
    const result = runMultiActorProgram(
      {
        schema: SCHEMA_VERSION,
        scripts: [
          {
            id: "a",
            trigger: { type: "onStart" },
            statements: [
              {
                type: "repeatUntil",
                condition: {
                  type: "greaterThan",
                  left: { type: "xPosition" },
                  right: { type: "numericLiteral", value: 5 },
                },
                body: [
                  { type: "move", steps: 10 },
                  { type: "broadcast", message: "hola" },
                ],
              },
            ],
          },
          {
            id: "b",
            trigger: { type: "onMessage", message: "hola" },
            statements: [{ type: "move", steps: 3 }],
          },
        ],
      },
      creative,
    );
    expect(result.actors[1]?.world.sprite.x).toBe(3);
  });
});

describe("changeSize", () => {
  it("grows and shrinks from the current size and stays within 1 to 400", () => {
    const grown = runProgram(
      program([
        { type: "changeSize", delta: 50 },
        { type: "changeSize", delta: -25 },
      ]),
      createWorldState(),
    );
    expect(grown.world.sprite.size).toBe(125);
    const floor = runProgram(program([{ type: "changeSize", delta: -100 }]), createWorldState());
    expect(floor.world.sprite.size).toBe(1);
    const ceiling = runProgram(
      program([
        { type: "setSize", size: 390 },
        { type: "changeSize", delta: 50 },
      ]),
      createWorldState(),
    );
    expect(ceiling.world.sprite.size).toBe(400);
  });
});

describe("modulo", () => {
  const remainder = (left: number, right: number) =>
    runProgram(
      {
        schema: SCHEMA_VERSION,
        variables: [{ id: "n", name: "n", initialValue: 0, visible: true }],
        scripts: [
          {
            id: "main",
            trigger: { type: "onStart" },
            statements: [
              {
                type: "setVariable",
                variableId: "n",
                value: {
                  type: "modulo",
                  left: { type: "numericLiteral", value: left },
                  right: { type: "numericLiteral", value: right },
                },
              },
            ],
          },
        ],
      },
      createWorldState(),
    ).world.variables?.n?.value;

  it("takes the sign of the divisor, like Scratch", () => {
    expect(remainder(7, 3)).toBe(1);
    expect(remainder(-7, 3)).toBe(2);
    expect(remainder(7, -3)).toBe(-2);
    expect(remainder(6, 3)).toBe(0);
  });

  it("fails deterministically on a zero divisor", () => {
    expect(() => remainder(7, 0)).toThrow(/modulo-by-zero/);
  });
});

describe("mathFunction", () => {
  const apply = (fn: "abs" | "round" | "floor" | "ceiling", value: number) =>
    runProgram(
      {
        schema: SCHEMA_VERSION,
        variables: [{ id: "n", name: "n", initialValue: 0, visible: true }],
        scripts: [
          {
            id: "main",
            trigger: { type: "onStart" },
            statements: [
              {
                type: "setVariable",
                variableId: "n",
                value: {
                  type: "mathFunction",
                  function: fn,
                  value: { type: "numericLiteral", value },
                },
              },
            ],
          },
        ],
      },
      createWorldState(),
    ).world.variables?.n?.value;

  it("applies each function to a number", () => {
    expect(apply("abs", -2.5)).toBe(2.5);
    expect(apply("round", 3.5)).toBe(4);
    expect(apply("round", -2.4)).toBe(-2);
    expect(apply("floor", -2.5)).toBe(-3);
    expect(apply("ceiling", 2.1)).toBe(3);
  });

  it("never produces negative zero", () => {
    expect(Object.is(apply("round", -0.4), 0)).toBe(true);
    expect(Object.is(apply("ceiling", -0.5), 0)).toBe(true);
  });
});

describe("goToLayer", () => {
  const actor = (id: string, scripts: string[]) => ({
    id,
    name: id,
    x: 0,
    y: 0,
    direction: 0,
    size: 100,
    visible: true,
    scripts,
  });
  const creative: ProjectCreativeState = {
    actors: [actor("actor:a", ["a"]), actor("actor:b", ["b"]), actor("actor:c", [])],
    stage: { actorOrder: ["actor:a", "actor:b", "actor:c"] },
  };
  const run = (aLayer: "front" | "back", bLayer: "front" | "back") =>
    runMultiActorProgram(
      {
        schema: SCHEMA_VERSION,
        scripts: [
          {
            id: "a",
            trigger: { type: "onStart" },
            statements: [{ type: "goToLayer", layer: aLayer }],
          },
          {
            id: "b",
            trigger: { type: "onStart" },
            statements: [
              { type: "goToLayer", layer: bLayer },
              { type: "move", steps: 5 },
            ],
          },
        ],
      },
      creative,
    );

  it("moves a character to the front or back of the stage order", () => {
    expect(run("front", "back").stage.actorOrder).toEqual(["actor:b", "actor:c", "actor:a"]);
    expect(run("back", "front").stage.actorOrder).toEqual(["actor:a", "actor:c", "actor:b"]);
  });

  it("does not change who runs first and records the order in each frame", () => {
    const result = run("front", "back");
    expect(result.trace.map((entry) => entry.actorId)).toEqual(["actor:a", "actor:b", "actor:b"]);
    expect(result.actors.find((item) => item.id === "actor:b")?.world.sprite.x).toBe(5);
    expect(result.frames[0]?.stage.actorOrder).toEqual(["actor:b", "actor:c", "actor:a"]);
  });

  it("is a harmless step for a lone sprite", () => {
    const result = runProgram(program([{ type: "goToLayer", layer: "front" }]), createWorldState());
    expect(result.outcome).toBe("completed");
    expect(result.stepsUsed).toBe(1);
  });
});
