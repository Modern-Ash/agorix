import { describe, expect, it } from "vitest";
import type { ProjectProgram, Statement } from "@agorix/program-model";
import { SCHEMA_VERSION } from "@agorix/program-model";
import { createWorldState, runProgram } from "@agorix/runtime";
import {
  KIDS_FREE_MISSION_ID,
  KIDS_GRID,
  KIDS_MISSION_IDS,
  cellToWorld,
  createFreeWorldMission,
  evaluateKidsRun,
  getKidsMission,
  kidsMoveSteps,
  validateMission,
  worldToCell,
} from "./index.js";

const move = (cells: number): Statement => ({ type: "move", steps: kidsMoveSteps(cells) });
const turnLeft: Statement = { type: "turn", degrees: -90 };
const turnRight: Statement = { type: "turn", degrees: 90 };

function program(statements: readonly Statement[]): ProjectProgram {
  return {
    schema: SCHEMA_VERSION,
    scripts: [{ id: "main", trigger: { type: "greenFlag" }, statements: [...statements] }],
  };
}

function play(missionId: string, statements: readonly Statement[]) {
  const mission = getKidsMission(missionId, "es");
  const result = runProgram(program(statements), createWorldState(mission.starterStage));
  return { mission, result, run: evaluateKidsRun({ mission, result }) };
}

describe("kids grid (issue #372)", () => {
  it("is a 6x4 grid with whole-pixel cells", () => {
    expect(KIDS_GRID).toEqual({ cols: 6, rows: 4, cellSize: 40 });
  });

  it("maps cells to world coordinates and back", () => {
    expect(cellToWorld({ cx: 4, cy: 2 })).toEqual({ x: 160, y: 80 });
    expect(worldToCell({ x: 160, y: 80 })).toEqual({ cx: 4, cy: 2 });
    for (let cx = 0; cx < KIDS_GRID.cols; cx += 1) {
      for (let cy = 0; cy < KIDS_GRID.rows; cy += 1) {
        expect(worldToCell(cellToWorld({ cx, cy }))).toEqual({ cx, cy });
      }
    }
  });

  it("converts a move of n cells into runtime steps", () => {
    expect(kidsMoveSteps(3)).toBe(120);
  });
});

describe("kids missions (issue #372)", () => {
  it("defines three missions that validate in both locales", () => {
    expect(KIDS_MISSION_IDS).toHaveLength(3);
    for (const id of KIDS_MISSION_IDS) {
      for (const locale of ["es", "en"] as const) {
        const mission = validateMission(getKidsMission(id, locale));
        expect(mission.hintLadder.map((hint) => hint.level)).toEqual([1, 2, 3, 4, 5]);
        expect(mission.completion).toEqual({ type: "spriteTouchingGoal" });
      }
    }
  });

  it("places start and goal as in the prototype", () => {
    const [a, b, c] = KIDS_MISSION_IDS.map((id) => getKidsMission(id, "en"));
    expect(a?.starterStage).toMatchObject({
      sprite: { x: 0, y: 80, heading: 0 },
      goal: { x: 160, y: 80 },
    });
    expect(b?.starterStage).toMatchObject({
      sprite: { x: 0, y: 120, heading: 0 },
      goal: { x: 120, y: 40 },
    });
    expect(c?.starterStage).toMatchObject({
      sprite: { x: 0, y: 0, heading: 0 },
      goal: { x: 120, y: 120 },
    });
  });

  it("returns Spanish by default for unknown locales' copy and English on request", () => {
    expect(getKidsMission(KIDS_MISSION_IDS[0]!, "en").title).not.toBe(
      getKidsMission(KIDS_MISSION_IDS[0]!, "es").title,
    );
  });

  it("rejects an unknown mission id", () => {
    expect(() => getKidsMission("kids.nope", "es")).toThrow();
  });
});

describe("parity with the prototype (hand-computed table in PLAN_INTEGRACION.md)", () => {
  const [A, B, C] = KIDS_MISSION_IDS as readonly [string, string, string];

  it("A: Move 4 reaches the goal", () => {
    const { run, result } = play(A, [move(4)]);
    expect(run.outcome).toBe("success");
    expect(run.final).toEqual({ cx: 4, cy: 2 });
    expect(result.outcome).toBe("completed");
  });

  it("A: Move 2 stops short", () => {
    expect(play(A, [move(2)]).run.outcome).toBe("short");
  });

  it("A: Move 5 passes the goal and ends beyond it", () => {
    const { run } = play(A, [move(5)]);
    expect(run.outcome).toBe("passed");
    expect(run.final).toEqual({ cx: 5, cy: 2 });
  });

  it("A: Move 6 hits the edge and the character stays on the last cell", () => {
    const { run } = play(A, [move(6)]);
    expect(run.outcome).toBe("wall");
    expect(run.final).toEqual({ cx: 5, cy: 2 });
    expect(run.wallAt).toEqual({ cx: 6, cy: 2 });
  });

  it("B: Move 6 hits the edge", () => {
    expect(play(B, [move(6)]).run.outcome).toBe("wall");
  });

  it("C: turn right, move 3, turn left, move 3 succeeds", () => {
    const { run } = play(C, [turnRight, move(3), turnLeft, move(3)]);
    expect(run.outcome).toBe("success");
    expect(run.final).toEqual({ cx: 3, cy: 3 });
  });

  it("B: move 3, turn left, move 2 succeeds", () => {
    expect(play(B, [move(3), turnLeft, move(2)]).run.outcome).toBe("success");
  });
});

describe("kids run trail (issue #372)", () => {
  it("lists every cell crossed, including those inside one Move block", () => {
    const { run } = play(KIDS_MISSION_IDS[0]!, [move(3)]);
    expect(run.trail).toEqual([
      { cx: 0, cy: 2 },
      { cx: 1, cy: 2 },
      { cx: 2, cy: 2 },
      { cx: 3, cy: 2 },
    ]);
  });

  it("stops the trail at the wall", () => {
    const { run } = play(KIDS_MISSION_IDS[0]!, [move(8), move(1)]);
    expect(run.trail.at(-1)).toEqual({ cx: 5, cy: 2 });
    expect(run.outcome).toBe("wall");
  });

  it("an empty program stays short at the start", () => {
    const { run } = play(KIDS_MISSION_IDS[1]!, []);
    expect(run.outcome).toBe("short");
    expect(run.final).toEqual({ cx: 0, cy: 3 });
  });

  it("tracks the heading as a compass direction", () => {
    expect(play(KIDS_MISSION_IDS[2]!, [turnRight]).run.heading).toBe("S");
    expect(play(KIDS_MISSION_IDS[2]!, [turnLeft]).run.heading).toBe("N");
  });
});

describe("free world mission (issue #372)", () => {
  it("builds a validated mission around the cell the child tapped", () => {
    const mission = validateMission(createFreeWorldMission({ cx: 5, cy: 0 }, "es"));
    expect(mission.id).toBe(KIDS_FREE_MISSION_ID);
    expect(mission.starterStage).toMatchObject({
      sprite: { x: 0, y: 80, heading: 0 },
      goal: { x: 200, y: 0 },
    });
  });

  it("refuses goals outside the grid or on the start cell", () => {
    expect(() => createFreeWorldMission({ cx: 6, cy: 0 }, "es")).toThrow();
    expect(() => createFreeWorldMission({ cx: 0, cy: 2 }, "es")).toThrow();
    expect(() => createFreeWorldMission({ cx: 1.5, cy: 2 }, "es")).toThrow();
  });

  it("accepts every non-start grid cell only with a runtime-proven route", () => {
    for (let cx = 0; cx < KIDS_GRID.cols; cx += 1) {
      for (let cy = 0; cy < KIDS_GRID.rows; cy += 1) {
        if (cx === 0 && cy === 2) continue;
        expect(createFreeWorldMission({ cx, cy }, "es").id).toBe(KIDS_FREE_MISSION_ID);
      }
    }
  });
});
