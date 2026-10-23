import { describe, expect, it } from "vitest";
import {
  proveAdvancedEntry,
  proveAdvancedScene,
  createMemoryAdvancedStageRepository,
} from "./advancedSessions.js";

const program = (statements: unknown[]) => ({
  schema: "agorix/program/v1",
  scripts: [{ id: "main", trigger: { type: "greenFlag" }, statements }],
});
const move = (cells: number) => ({ type: "move", steps: cells * 40 });
const turn = (degrees: number) => ({ type: "turn", degrees });
const proof = [
  program([move(4)]),
  program([move(3), turn(-90), move(2)]),
  program([turn(90), move(3), turn(-90), move(3)]),
];

describe("anonymous advanced stage repository", () => {
  it("checks M1–M3 by replaying canonical programs and expires the token", () => {
    expect(proveAdvancedEntry(proof)).toBe(true);
    expect(proveAdvancedEntry([proof[0], proof[1], program([])])).toBe(false);
    expect(
      proveAdvancedEntry([proof[0], proof[1], program([{ type: "broadcast", message: "x" }])]),
    ).toBe(false);
    let now = 100;
    const repo = createMemoryAdvancedStageRepository(() => now);
    const token = repo.create("scene");
    expect(repo.get(token)).toBe("scene");
    now += 30 * 60_000;
    expect(repo.get(token)).toBeUndefined();
  });
  it("unlocks stage 2 only after a real scene runtime change and sound", () => {
    expect(proveAdvancedScene(program([]))).toBe(false);
    const scene = program([
      { type: "switchCostume", costumeId: "asset:costume.spark" },
      { type: "playSound", soundId: "asset:sound.beacon" },
    ]);
    const valid = { ...scene, scripts: [{ ...scene.scripts[0]!, id: "advanced-scene" }] };
    expect(proveAdvancedScene(valid)).toBe(true);
    expect(
      proveAdvancedScene({
        ...valid,
        scripts: [
          {
            ...valid.scripts[0]!,
            statements: [{ type: "playSound", soundId: "asset:sound.beacon" }],
          },
        ],
      }),
    ).toBe(false);
  });
});
