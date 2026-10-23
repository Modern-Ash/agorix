import { randomUUID } from "node:crypto";
import { evaluateKidsRun, getKidsMission, KIDS_MISSION_IDS } from "@agorix/curriculum";
import { validateProgram, type ProjectProgram, type Statement } from "@agorix/program-model";
import { createWorldState, runProgram } from "@agorix/runtime";

export interface AdvancedStageRepository {
  create(stage: "scene"): string;
  get(token: string): "scene" | undefined;
}

/** Replaceable by a persisted implementation without changing the HTTP contract. */
export function createMemoryAdvancedStageRepository(now = Date.now): AdvancedStageRepository {
  const sessions = new Map<string, { stage: "scene"; expires: number }>();
  return {
    create(stage) {
      for (const [token, value] of sessions) if (value.expires <= now()) sessions.delete(token);
      if (sessions.size >= 1024) sessions.delete(sessions.keys().next().value!);
      const token = randomUUID();
      sessions.set(token, { stage, expires: now() + 30 * 60_000 });
      return token;
    },
    get(token) {
      const value = sessions.get(token);
      if (!value) return undefined;
      if (value.expires <= now()) {
        sessions.delete(token);
        return undefined;
      }
      return value.stage;
    },
  };
}

function allowed(statement: Statement, missionIndex: number): boolean {
  if (statement.type === "move")
    return (
      Number.isInteger(statement.steps / 40) && statement.steps >= 40 && statement.steps <= 200
    );
  if (statement.type === "turn") return missionIndex >= 1 && Math.abs(statement.degrees) === 90;
  if (statement.type === "repeat")
    return (
      missionIndex >= 2 &&
      statement.count >= 2 &&
      statement.count <= 6 &&
      statement.body.length === 1 &&
      statement.body[0]?.type === "move" &&
      allowed(statement.body[0], missionIndex)
    );
  return false;
}

export function proveAdvancedEntry(raw: unknown): boolean {
  if (!Array.isArray(raw) || raw.length !== 3) return false;
  try {
    return KIDS_MISSION_IDS.every((id, index) => {
      const program = validateProgram(raw[index] as ProjectProgram);
      if (
        program.scripts.length !== 1 ||
        program.scripts[0]?.trigger.type !== "greenFlag" ||
        program.scripts[0].statements.length > 24 ||
        program.scripts[0].statements.some((statement) => !allowed(statement, index))
      )
        return false;
      const mission = getKidsMission(id, "es");
      const result = runProgram(program, createWorldState(mission.starterStage));
      return evaluateKidsRun({ mission, result }).outcome === "success";
    });
  } catch {
    return false;
  }
}
