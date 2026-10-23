import { randomUUID } from "node:crypto";
import {
  evaluateKidsRun,
  getKidsMission,
  KIDS_MISSION_IDS,
  getKidsAdvancedMission,
  evaluateKidsAdvancedMission,
} from "@agorix/curriculum";
import { validateProgram, type ProjectProgram, type Statement } from "@agorix/program-model";
import { createWorldState, runProgram, runMultiActorProgram } from "@agorix/runtime";
import { createOriAdvancedInput, createOriReactInput } from "@agorix/ori-agent";

export type ServerAdvancedStage = "scene" | "react" | "score";

export interface AdvancedStageRepository {
  create(stage: ServerAdvancedStage): string;
  get(token: string): ServerAdvancedStage | undefined;
}

/** Replaceable by a persisted implementation without changing the HTTP contract. */
export function createMemoryAdvancedStageRepository(now = Date.now): AdvancedStageRepository {
  const sessions = new Map<string, { stage: ServerAdvancedStage; expires: number }>();
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

/** The stage-2 gate replays an actual scene rather than trusting a completion flag. */
export function proveAdvancedScene(raw: unknown): boolean {
  try {
    const program = validateProgram(raw as ProjectProgram);
    createOriAdvancedInput({ stage: "scene", actorId: "actor:ori", locale: "es", program });
    const mission = getKidsAdvancedMission("scene", "es");
    const creative = {
      ...mission.starterCreative,
      actors: (mission.starterCreative.actors ?? []).map((actor) =>
        actor.id === "actor:friend" && program.scripts[1]?.id === "advanced-scene-friend"
          ? { ...actor, scripts: ["advanced-scene-friend"] }
          : actor,
      ),
    };
    return evaluateKidsAdvancedMission("scene", runMultiActorProgram(program, creative));
  } catch {
    return false;
  }
}

/** Stage 3 requires a replayable event reaction from the previous stage. */
export function proveAdvancedReact(raw: unknown): boolean {
  try {
    const program = validateProgram(raw as ProjectProgram);
    const mission = getKidsAdvancedMission("react", "es");
    const hasFriend = program.scripts[1]?.id === "advanced-react-friend";
    const creative = {
      ...mission.starterCreative,
      actors: (mission.starterCreative.actors ?? []).map((actor) =>
        actor.id === "actor:friend" && hasFriend
          ? { ...actor, scripts: ["advanced-react-friend"] }
          : actor,
      ),
    };
    for (const actorId of ["actor:ori", "actor:friend"] as const) {
      if (actorId === "actor:friend" && !hasFriend) continue;
      createOriReactInput({ stage: "react", actorId, locale: "es", program });
      if (
        evaluateKidsAdvancedMission(
          "react",
          runMultiActorProgram(program, creative, { events: [{ type: "actorClicked", actorId }] }),
        )
      )
        return true;
    }
    return false;
  } catch {
    return false;
  }
}
