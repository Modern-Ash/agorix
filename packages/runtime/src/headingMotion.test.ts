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
