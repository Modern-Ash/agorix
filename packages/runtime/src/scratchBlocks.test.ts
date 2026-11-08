import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type ProjectProgram, type Statement } from "@agorix/program-model";
import { createWorldState, runProgram } from "./index.js";
import { createLiveRuntime, LIVE_TICK_SECONDS } from "./liveRuntime.js";

const program = (statements: Statement[]): ProjectProgram => ({
  schema: SCHEMA_VERSION,
  scripts: [{ id: "main", trigger: { type: "onStart" }, statements }],
});

describe("Scratch motion and looks blocks", () => {
  it("sets and changes one coordinate without touching the other or the heading", () => {
    const result = runProgram(
      program([
        { type: "turn", degrees: 90 },
        { type: "setX", x: 50 },
        { type: "setY", y: -20 },
        { type: "changeX", dx: 30 },
        { type: "changeY", dy: -10 },
      ]),
      createWorldState(),
    );
    const { x, y, heading } = result.world.sprite;
    expect({ x, y, heading }).toEqual({ x: 80, y: -30, heading: 90 });
  });

  it("reports the heading as a number", () => {
    const result = runProgram(
      {
        schema: SCHEMA_VERSION,
        variables: [{ id: "dir", name: "dir", initialValue: 0, visible: false }],
        scripts: [
          {
            id: "main",
            trigger: { type: "onStart" },
            statements: [
              { type: "turn", degrees: 45 },
              { type: "setVariable", variableId: "dir", value: { type: "direction" } },
            ],
          },
        ],
      },
      createWorldState(),
    );
    expect(result.world.variables?.dir?.value).toBe(45);
  });

  it("draws the pen trail for the new moves", () => {
    const result = runProgram(
      {
        schema: SCHEMA_VERSION,
        extensions: ["pen"],
        scripts: [
          {
            id: "main",
            trigger: { type: "onStart" },
            statements: [{ type: "penDown" }, { type: "changeX", dx: 40 }],
          },
        ],
      },
      createWorldState(),
    );
    const segments = result.world.pen?.segments ?? [];
    expect(segments.at(-1)).toMatchObject({ x1: 0, x2: 40 });
  });

  it("say for N seconds keeps the bubble in the trace, spends the time and ends without it", () => {
    const result = runProgram(
      program([
        { type: "say", text: "Hola", seconds: 2 },
        { type: "move", steps: 1 },
      ]),
      createWorldState(),
    );
    expect(result.trace[0]!.worldAfter.sprite.bubble).toEqual({ kind: "say", text: "Hola" });
    expect(result.trace[1]!.worldBefore.sprite.bubble).toBeUndefined();
    expect(result.world.sprite.bubble).toBeUndefined();
    expect(result.virtualSeconds).toBe(2);
  });

  it("a plain say still leaves its bubble on", () => {
    const result = runProgram(program([{ type: "say", text: "Hola" }]), createWorldState());
    expect(result.world.sprite.bubble).toEqual({ kind: "say", text: "Hola" });
  });

  it("live: the bubble stays for its seconds and then goes away", () => {
    const live = createLiveRuntime(program([{ type: "think", text: "Mmm", seconds: 1 }]));
    live.fire({ type: "start" });
    const bubble = () => live.result().actors[0]!.world.sprite.bubble;
    for (let t = 0; t < 0.5; t += LIVE_TICK_SECONDS) live.advance(LIVE_TICK_SECONDS);
    expect(bubble()).toEqual({ kind: "think", text: "Mmm" });
    for (let t = 0; t < 1; t += LIVE_TICK_SECONDS) live.advance(LIVE_TICK_SECONDS);
    expect(bubble()).toBeUndefined();
    expect(live.running).toBe(false);
  });
});
