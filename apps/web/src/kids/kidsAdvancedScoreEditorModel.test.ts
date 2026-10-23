import { describe, expect, it } from "vitest";
import { createEditorHistory, undoCanonicalTransaction } from "@agorix/block-editor";
import { evaluateKidsAdvancedMission, getKidsAdvancedMission } from "@agorix/curriculum";
import { runMultiActorProgram } from "@agorix/runtime";
import {
  addScoreStatement,
  addScoreListOperation,
  createScoreList,
  scoreDataStatements,
  validateScoreDataProgram,
  scoreArithmetic,
  scoreArithmeticStatement,
  removeScoreStatement,
  scoreStatements,
} from "./kidsAdvancedScoreEditorModel.js";
import { parseAgorixProject, serializeAgorixProject } from "@agorix/persistence";

describe("advanced score editor", () => {
  it("stores score blocks in the canonical program and the watcher sees runtime truth", () => {
    const mission = getKidsAdvancedMission("score", "es");
    const start = createEditorHistory(mission.starterProgram);
    const history = addScoreStatement(start, {
      type: "changeVariable",
      variableId: "score",
      delta: { type: "numericLiteral", value: 1 },
    });
    expect(scoreStatements(history.current)).toHaveLength(1);
    const result = runMultiActorProgram(history.current, mission.starterCreative);
    expect(result.actors[0]?.world.variables?.score).toMatchObject({ value: 1, visible: true });
    expect(scoreStatements(undoCanonicalTransaction(history).history.current)).toHaveLength(0);
    expect(scoreStatements(removeScoreStatement(history, 0).current)).toHaveLength(0);
  });

  it("rejects edits to another variable or an unbounded value", () => {
    const history = createEditorHistory(getKidsAdvancedMission("score", "es").starterProgram);
    expect(() =>
      addScoreStatement(history, {
        type: "changeVariable",
        variableId: "other",
        delta: { type: "numericLiteral", value: 1 },
      }),
    ).toThrow();
    expect(() =>
      addScoreStatement(history, {
        type: "setVariable",
        variableId: "score",
        value: { type: "numericLiteral", value: 999 },
      }),
    ).toThrow();
  });

  describe("arithmetic on the score (issue #465)", () => {
    const mission = getKidsAdvancedMission("score", "es");
    const start = createEditorHistory(mission.starterProgram);
    const set = (value: number) => ({
      type: "setVariable" as const,
      variableId: "score",
      value: { type: "numericLiteral" as const, value },
    });
    const shown = (history: typeof start) =>
      runMultiActorProgram(history.current, mission.starterCreative).actors[0]?.world.variables
        ?.score?.value;

    it("score 3, score + 2 shows 5 and score - 5 then shows -2 without error", () => {
      let history = addScoreStatement(start, set(3));
      history = addScoreStatement(history, scoreArithmeticStatement("add", 2));
      expect(shown(history)).toBe(5);
      history = addScoreStatement(history, scoreArithmeticStatement("subtract", 5));
      expect(shown(history)).toBe(0);
      const negative = addScoreStatement(
        addScoreStatement(start, set(3)),
        scoreArithmeticStatement("subtract", 5),
      );
      expect(shown(negative)).toBe(-2);
      expect(scoreStatements(negative.current).map((item) => scoreArithmetic(item))).toEqual([
        null,
        { op: "subtract", amount: 5 },
      ]);
    });

    it("counts as a runtime-proven change for the mission", () => {
      const history = addScoreStatement(start, scoreArithmeticStatement("add", 2));
      const result = runMultiActorProgram(history.current, mission.starterCreative);
      expect(evaluateKidsAdvancedMission("score", result)).toBe(true);
    });

    it("undo removes the arithmetic block in one step", () => {
      const history = addScoreStatement(start, scoreArithmeticStatement("add", 1));
      expect(scoreStatements(undoCanonicalTransaction(history).history.current)).toHaveLength(0);
    });

    it("rejects other variables, amounts outside 1-5 and unsupported shapes", () => {
      const num = (value: number) => ({ type: "numericLiteral" as const, value });
      for (const amount of [0, 6, 1.5, -1, Number.NaN]) {
        expect(() => addScoreStatement(start, scoreArithmeticStatement("add", amount))).toThrow();
      }
      expect(() =>
        addScoreStatement(start, {
          type: "setVariable",
          variableId: "score",
          value: {
            type: "multiply",
            left: { type: "variable", variableId: "score" },
            right: num(2),
          },
        }),
      ).toThrow();
      expect(() =>
        addScoreStatement(start, {
          type: "setVariable",
          variableId: "score",
          value: { type: "add", left: { type: "variable", variableId: "other" }, right: num(1) },
        }),
      ).toThrow();
    });

    it("a division by zero fails in the runtime instead of showing NaN", () => {
      const program = {
        ...mission.starterProgram,
        scripts: [
          {
            ...mission.starterProgram.scripts[0]!,
            statements: [
              {
                type: "setVariable" as const,
                variableId: "score",
                value: {
                  type: "divide" as const,
                  left: { type: "numericLiteral" as const, value: 1 },
                  right: { type: "numericLiteral" as const, value: 0 },
                },
              },
            ],
          },
        ],
      };
      expect(() => runMultiActorProgram(program, mission.starterCreative)).toThrow();
    });
  });
});

describe("advanced visual lists (#525)", () => {
  const mission = getKidsAdvancedMission("score", "es");
  const start = createEditorHistory(mission.starterProgram);

  it("uses canonical list operations and runtime watcher truth", () => {
    let history = createScoreList(start);
    history = addScoreListOperation(history, "add", 7);
    history = addScoreListOperation(history, "add", 9);
    history = addScoreListOperation(history, "item", 2);
    let run = runMultiActorProgram(history.current, mission.starterCreative);
    expect(run.actors[0]?.world.lists?.items?.items).toEqual([7, 9]);
    expect(run.actors[0]?.world.variables?.score?.value).toBe(9);
    history = addScoreListOperation(history, "remove", 1);
    history = addScoreListOperation(history, "length", 0);
    run = runMultiActorProgram(history.current, mission.starterCreative);
    expect(run.actors[0]?.world.lists?.items?.items).toEqual([9]);
    expect(run.actors[0]?.world.variables?.score?.value).toBe(1);
    expect(scoreDataStatements(history.current)).toHaveLength(5);
    expect(scoreDataStatements(undoCanonicalTransaction(history).history.current)).toHaveLength(4);
  });

  it("gives safe results for empty, zero, negative and out-of-range indices", () => {
    const empty = addScoreListOperation(createScoreList(start), "item", 1);
    const emptyRun = runMultiActorProgram(empty.current, mission.starterCreative);
    expect(emptyRun.actors[0]?.world.variables?.score?.value).toBe(0);
    for (const index of [0, -1, 101]) {
      const read = addScoreListOperation(createScoreList(start), "item", index);
      const run = runMultiActorProgram(read.current, mission.starterCreative);
      expect(run.actors[0]?.world.variables?.score?.value).toBe(0);
      const remove = addScoreListOperation(createScoreList(start), "remove", index);
      expect(
        runMultiActorProgram(remove.current, mission.starterCreative).actors[0]?.world.lists?.items
          ?.items,
      ).toEqual([]);
    }
  });

  it("rejects invalid values and cannot exceed the 100-item runtime cap", () => {
    const history = createScoreList(start);
    for (const bad of [Number.NaN, 1.5, 1_000_001]) {
      expect(() => addScoreListOperation(history, "add", bad)).toThrow();
    }
    let full = history;
    for (let i = 0; i < 101; i++) full = addScoreListOperation(full, "add", i);
    expect(
      runMultiActorProgram(full.current, mission.starterCreative).actors[0]?.world.lists?.items
        ?.items,
    ).toHaveLength(100);
  });

  it("preserves lists across .agorix export/import and accepts old score projects", () => {
    const history = addScoreListOperation(createScoreList(start), "add", 3);
    const metadata = {
      createdAt: "2026-10-23T00:00:00.000Z",
      updatedAt: "2026-10-23T00:00:00.000Z",
      missionProgress: 0,
      hintLevel: 0,
      locale: "es",
    };
    const exported = serializeAgorixProject({
      schemaVersion: history.current.schema,
      program: history.current,
      metadata,
    });
    expect(validateScoreDataProgram(parseAgorixProject(exported).project.program)).toEqual(
      history.current,
    );
    expect(validateScoreDataProgram(mission.starterProgram).lists).toBeUndefined();
  });

  it("rejects imported stage programs with undeclared lists or unrelated blocks", () => {
    const valid = createScoreList(start).current;
    expect(() =>
      validateScoreDataProgram({
        ...mission.starterProgram,
        scripts: [
          {
            ...mission.starterProgram.scripts[0]!,
            statements: [
              { type: "listAdd", listId: "items", value: { type: "numericLiteral", value: 1 } },
            ],
          },
        ],
      }),
    ).toThrow();
    expect(() =>
      validateScoreDataProgram({
        ...valid,
        scripts: [{ ...valid.scripts[0]!, statements: [{ type: "move", steps: 1 }] }],
      }),
    ).toThrow();
    expect(() =>
      validateScoreDataProgram({
        ...valid,
        variables: [{ ...valid.variables![0]!, initialValue: 3 }],
      }),
    ).toThrow();
  });
});
