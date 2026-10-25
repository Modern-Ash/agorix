import { describe, expect, it } from "vitest";
import {
  TEAM_GAME_MAX_PLAYERS,
  activeTeamGameSlots,
  actorOnGoal,
  createTeamGameProgram,
  createTeamGameSim,
  initialTeamGameView,
  isTeamGameDirection,
  teamGameEventForInput,
  teamGameInput,
  teamGameView,
} from "./teamGame.js";

describe("team game", () => {
  it("builds four independent actors with one script per direction", () => {
    const program = createTeamGameProgram();
    expect(program.scripts).toHaveLength(TEAM_GAME_MAX_PLAYERS * 4);
    expect(initialTeamGameView().actors).toHaveLength(TEAM_GAME_MAX_PLAYERS);
    expect(initialTeamGameView().actors[0]?.id).toBe("actor:p0");
  });

  it("maps each child's slot to a distinct key and rejects unknown input", () => {
    expect(teamGameEventForInput("right", 0, 0)).toEqual({
      type: "keyPressed",
      key: "0:right",
    });
    expect(teamGameEventForInput("right", 0, 1)).toEqual({
      type: "keyPressed",
      key: "1:right",
    });
    expect(teamGameEventForInput("sideways", 0, 0)).toBeUndefined();
    expect(teamGameInput(null)).toBeNull();
    expect(isTeamGameDirection("up")).toBe(true);
    expect(isTeamGameDirection("jump")).toBe(false);
  });

  it("advances only the actor whose slot sent the input and stays deterministic", () => {
    const first = createTeamGameSim();
    const second = createTeamGameSim();
    const frame = { n: 0, inputs: ["right", "left", null, "up"] as const };
    first.apply(frame);
    second.apply(frame);

    const view = teamGameView(first.snapshot());
    expect(first.digest()).toBe(second.digest());
    expect(view.actors[0]?.x).toBeGreaterThan(44);
    expect(view.actors[1]?.x).toBeLessThan(276);
    expect(view.actors[2]?.x).toBe(44);
    expect(view.actors[3]?.y).toBeGreaterThan(52);
  });

  it("filters absent slots and measures the shared goal", () => {
    expect(activeTeamGameSlots(4, [])).toEqual([0, 1, 2, 3]);
    expect(activeTeamGameSlots(4, [1, 3])).toEqual([0, 2]);
    expect(actorOnGoal({ id: "actor:p0", name: "Player 1", x: 160, y: 100, visible: true })).toBe(
      true,
    );
    expect(actorOnGoal({ id: "actor:p0", name: "Player 1", x: 0, y: -100, visible: true })).toBe(
      false,
    );
  });
});
