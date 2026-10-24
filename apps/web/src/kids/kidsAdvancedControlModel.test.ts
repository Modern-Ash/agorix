import { describe, expect, it } from "vitest";
import { createEditorHistory, undoCanonicalTransaction } from "@agorix/block-editor";
import { evaluateKidsAdvancedMission, getKidsAdvancedMission } from "@agorix/curriculum";
import { runMultiActorProgram } from "@agorix/runtime";
import {
  addAdvancedOperation,
  controlStatement,
  removeAdvancedOperation,
  validateControlStageProgram,
} from "./kidsAdvancedControlModel.js";

describe("Kids advanced control and messages (#526)", () => {
  it("builds canonical >=, <, bounded random, if/else and wait; undo restores the script", () => {
    const mission = getKidsAdvancedMission("control", "es");
    let history = createEditorHistory(mission.starterProgram);
    history = addAdvancedOperation(history, "control", "random", 2, 4);
    history = addAdvancedOperation(history, "control", "atLeast", 2);
    history = addAdvancedOperation(history, "control", "lessThan", 5);
    history = addAdvancedOperation(history, "control", "wait", 1);
    const program = validateControlStageProgram(history.current, "control");
    expect(program.scripts[0]?.statements.map((statement) => statement.type)).toEqual([
      "setVariable",
      "if",
      "if",
      "wait",
    ]);
    const a = runMultiActorProgram(program, mission.starterCreative, { randomSeed: 42 });
    const b = runMultiActorProgram(structuredClone(program), mission.starterCreative, {
      randomSeed: 42,
    });
    expect(a).toEqual(b);
    expect(evaluateKidsAdvancedMission("control", a)).toBe(true);
    expect(undoCanonicalTransaction(history).history.current.scripts[0]?.statements).toHaveLength(
      3,
    );
    history = removeAdvancedOperation(history, "control", 0, 0);
    expect(history.current.scripts[0]?.statements).toHaveLength(3);
    expect(controlStatement("atLeast", 2)).toMatchObject({
      type: "if",
      else: [{ type: "setVariable" }],
    });
    const branch = addAdvancedOperation(
      createEditorHistory(mission.starterProgram),
      "control",
      "atLeast",
      1,
    );
    const falseRun = runMultiActorProgram(branch.current, mission.starterCreative);
    expect(falseRun.actors[0]?.world.variables?.score?.value).toBe(2);
    const less = addAdvancedOperation(
      createEditorHistory(mission.starterProgram),
      "control",
      "lessThan",
      1,
    );
    const trueRun = runMultiActorProgram(less.current, mission.starterCreative);
    expect(trueRun.actors[0]?.world.variables?.score?.value).toBe(1);
  });

  it("rejects malformed bounds, unrelated scripts and unsafe imported operations", () => {
    expect(() => controlStatement("random", 5, 4)).toThrow();
    expect(() => controlStatement("wait", 11)).toThrow();
    const mission = getKidsAdvancedMission("control", "en");
    expect(() =>
      validateControlStageProgram({ ...mission.starterProgram, scripts: [] }, "control"),
    ).toThrow();
    const unrelated = {
      ...mission.starterProgram,
      scripts: [
        {
          ...mission.starterProgram.scripts[0]!,
          statements: [{ type: "broadcast" as const, message: "go" }],
        },
      ],
    };
    expect(() => validateControlStageProgram(unrelated, "control")).toThrow();
  });

  it("runs one broadcast with two independent receive handlers", () => {
    const mission = getKidsAdvancedMission("message", "es");
    let history = createEditorHistory(mission.starterProgram);
    history = addAdvancedOperation(history, "message", "send");
    history = addAdvancedOperation(history, "message", "oriReceive");
    history = addAdvancedOperation(history, "message", "friendReceive");
    const program = validateControlStageProgram(history.current, "message");
    const run = runMultiActorProgram(program, mission.starterCreative);
    expect(run.trace.map((entry) => [entry.actorId, entry.statementType])).toEqual([
      ["actor:ori", "broadcast"],
      ["actor:ori", "move"],
      ["actor:friend", "move"],
    ]);
    expect(evaluateKidsAdvancedMission("message", run)).toBe(true);
    expect(run.actors.map((actor) => actor.world.sprite.x)).toEqual([1, 81]);
    const missing = removeAdvancedOperation(history, "message", 2, 0);
    expect(
      evaluateKidsAdvancedMission(
        "message",
        runMultiActorProgram(missing.current, mission.starterCreative),
      ),
    ).toBe(false);
  });
});
