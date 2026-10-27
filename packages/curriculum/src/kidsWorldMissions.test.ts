import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type Statement } from "@agorix/program-model";
import { createWorldState, runProgram } from "@agorix/runtime";
import {
  evaluateKidsRun,
  getKidsMission,
  KIDS_GRID,
  KIDS_MISSION_IDS,
  KIDS_MISSION_WORLDS,
  kidsMissionLayout,
  kidsMoveSteps,
} from "./kids.js";

// Issue #612: every world has its own three missions, each proven solvable by the real runtime.
const cases = KIDS_MISSION_WORLDS.flatMap((world) =>
  KIDS_MISSION_IDS.map((id) => [world, id] as const),
);

/** The shortest honest answer from the layout: right, then up or down. */
function witness(id: string, world: (typeof KIDS_MISSION_WORLDS)[number]): Statement[] {
  const { start, goal } = kidsMissionLayout(id, world);
  const route: Statement[] = [{ type: "move", steps: kidsMoveSteps(goal.cx - start.cx) }];
  const dy = goal.cy - start.cy;
  if (dy !== 0) {
    route.push({ type: "turn", degrees: dy > 0 ? 90 : -90 });
    route.push({ type: "move", steps: kidsMoveSteps(Math.abs(dy)) });
  }
  return route;
}

describe("world missions", () => {
  it.each(cases)("%s / %s is inside the grid and the goal is somewhere new", (world, id) => {
    const { start, goal } = kidsMissionLayout(id, world);
    for (const cell of [start, goal]) {
      expect(cell.cx).toBeGreaterThanOrEqual(0);
      expect(cell.cx).toBeLessThan(KIDS_GRID.cols);
      expect(cell.cy).toBeGreaterThanOrEqual(0);
      expect(cell.cy).toBeLessThan(KIDS_GRID.rows);
    }
    expect(goal).not.toEqual(start);
    expect(goal.cx).toBeGreaterThan(start.cx);
  });

  it.each(cases)("%s / %s is solved by the canonical runtime", (world, id) => {
    const mission = getKidsMission(id, "es", world);
    const result = runProgram(
      {
        schema: SCHEMA_VERSION,
        scripts: [{ id: "main", trigger: { type: "greenFlag" }, statements: witness(id, world) }],
      },
      createWorldState(mission.starterStage),
    );
    expect(evaluateKidsRun({ mission, result }).outcome).toBe("success");
  });

  it("an empty program is not a solution anywhere", () => {
    for (const [world, id] of cases) {
      const mission = getKidsMission(id, "es", world);
      const result = runProgram(mission.starterProject, createWorldState(mission.starterStage));
      expect(evaluateKidsRun({ mission, result }).outcome).not.toBe("success");
    }
  });

  it("each world differs: no two missions share a layout or a title", () => {
    const layouts = new Set(
      cases.map(([world, id]) => JSON.stringify(kidsMissionLayout(id, world))),
    );
    expect(layouts.size).toBe(cases.length);
    for (const locale of ["es", "en"]) {
      const titles = new Set(cases.map(([world, id]) => getKidsMission(id, locale, world).title));
      expect(titles.size).toBe(cases.length);
    }
  });

  it("keeps the mission id, so saved projects, progress and the tutor still match", () => {
    for (const [world, id] of cases) expect(getKidsMission(id, "es", world).id).toBe(id);
    // Without a world the original (space) missions are exactly what they were.
    for (const id of KIDS_MISSION_IDS) {
      expect(getKidsMission(id, "es")).toEqual(getKidsMission(id, "es", "space"));
    }
    expect(kidsMissionLayout(KIDS_MISSION_IDS[0])).toEqual({
      start: { cx: 0, cy: 2 },
      goal: { cx: 4, cy: 2 },
    });
  });

  it("counts the squares of its own layout in the hints, in both languages", () => {
    for (const [world, id] of cases) {
      if (world === "space") continue;
      const { start, goal } = kidsMissionLayout(id, world);
      const dx = String(goal.cx - start.cx);
      for (const locale of ["es", "en"]) {
        const hints = getKidsMission(id, locale, world).hintLadder.map((hint) => hint.text);
        expect(hints).toHaveLength(5);
        expect(hints.join(" ")).toContain(dx);
        // The last hint is the idea itself and names the right move.
        expect(hints[4]).toContain(dx);
      }
    }
  });

  it("only the third mission of a world asks for repetition", () => {
    for (const world of KIDS_MISSION_WORLDS) {
      const concepts = KIDS_MISSION_IDS.map((id) => getKidsMission(id, "es", world).concepts);
      expect(concepts.map((list) => list.includes("repetition"))).toEqual([false, false, true]);
    }
  });
});
