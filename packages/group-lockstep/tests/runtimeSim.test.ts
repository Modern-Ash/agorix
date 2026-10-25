import { describe, expect, it, vi } from "vitest";
import { SCHEMA_VERSION, type ProjectProgram } from "@agorix/program-model";
import { RuntimeSim } from "../src/index.js";

const program: ProjectProgram = {
  schema: SCHEMA_VERSION,
  variables: [{ id: "steps", name: "steps", initialValue: 0, visible: true }],
  scripts: [
    {
      id: "right",
      trigger: { type: "onKeyPressed", key: "ArrowRight" },
      statements: [
        { type: "move", steps: 5 },
        {
          type: "changeVariable",
          variableId: "steps",
          delta: { type: "numericLiteral", value: 1 },
        },
      ],
    },
    {
      id: "left",
      trigger: { type: "onKeyPressed", key: "ArrowLeft" },
      statements: [{ type: "move", steps: -5 }],
    },
  ],
};

const sim = (onFrame?: ConstructorParameters<typeof RuntimeSim>[0]["onFrame"]) =>
  new RuntimeSim({
    program,
    randomSeed: 3,
    eventForInput: (input) =>
      input === "right" ? { type: "keyPressed", key: "ArrowRight" } : undefined,
    ...(onFrame === undefined ? {} : { onFrame }),
  });

describe("RuntimeSim", () => {
  it("maps ordered inputs to runtime events and reports each applied frame", () => {
    const onFrame = vi.fn();
    const game = sim(onFrame);
    game.apply({ n: 0, inputs: ["right", null] });
    game.apply({ n: 1, inputs: ["other", "right"] });

    expect(onFrame).toHaveBeenCalledTimes(2);
    expect(onFrame.mock.calls[0]?.[0]).toEqual({ n: 0, inputs: ["right", null] });
    expect(onFrame.mock.calls[1]?.[1].trace.map((entry) => entry.scriptId)).toEqual([
      "right",
      "right",
    ]);
    expect(game.snapshot().actors[0]?.world.variables?.["steps"]?.value).toBe(2);
    expect(game.snapshot().actors[0]?.world.sprite.x).toBe(10);
  });

  it("produces the same digest on two devices for the same frames", () => {
    const a = sim();
    const b = sim();
    for (const frame of [
      { n: 0, inputs: ["right", "left"] },
      { n: 1, inputs: [null, "right"] },
    ]) {
      a.apply(frame);
      b.apply(frame);
      expect(a.digest()).toBe(b.digest());
    }
  });

  it("restores a diverged device from a snapshot", () => {
    const host = sim();
    host.apply({ n: 0, inputs: ["right"] });
    host.apply({ n: 1, inputs: ["right"] });
    const snapshot = JSON.parse(JSON.stringify(host.snapshot())) as unknown;
    const digest = host.digest();
    host.apply({ n: 2, inputs: ["right"] });
    expect(host.digest()).not.toBe(digest);

    host.restore(snapshot);
    expect(host.digest()).toBe(digest);
    host.apply({ n: 2, inputs: ["right"] });
    expect(host.digest()).not.toBe(digest);
  });
});
