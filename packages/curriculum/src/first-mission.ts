/**
 * "First Mission" — the only functional POC mission (docs/product/LEARNER_JOURNEY.md D8).
 * Completion is always evaluated by `@agorix/runtime`'s deterministic
 * `touchingGoal` result; never by an AI/tutor claim (docs/product/LEARNER_JOURNEY.md §7).
 */
import { SCHEMA_VERSION, type ProjectProgram } from "@agorix/program-model";
import type { WorldConfig } from "@agorix/runtime";

export const FIRST_MISSION_ID = "first-mission";

export const FIRST_MISSION_WORLD: WorldConfig = {
  start: { x: 0, y: 0 },
  startHeading: 0,
  goal: { x: 30, y: 0 },
  goalRadius: 2,
};

/**
 * The learner's starting program: deliberately incomplete (stops 10 units
 * short of the goal) so the AI-native loop (AC-002) has a real, bounded gap
 * to propose closing — not a cosmetic demo.
 */
export const FIRST_MISSION_STARTING_PROGRAM: ProjectProgram = {
  schema: SCHEMA_VERSION,
  scripts: [
    {
      id: "main",
      trigger: { type: "onStart" },
      statements: [{ type: "move", steps: 20 }],
    },
  ],
};

export interface MissionCompletionResult {
  readonly missionId: string;
  readonly reachedGoal: boolean;
}
