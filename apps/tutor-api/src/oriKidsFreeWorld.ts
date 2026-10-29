import { verifyKidsFreeGoal, type MissionDefinition } from "@agorix/curriculum";
import type { StoredProject } from "@agorix/persistence";
import type { WorldStateInput } from "@agorix/runtime";

const FREE_GOAL = /^kids\.cell\.([0-5])\.([0-3])$/;

/** Derive the runtime world from the persisted Kids mission, never from request metadata. */
export function oriKidsFreeMission(project: StoredProject): MissionDefinition | null {
  const spec = project.metadata.missionSpec;
  if (!spec) return null;
  const match = FREE_GOAL.exec(spec.goal);
  if (!match) return null;
  try {
    return verifyKidsFreeGoal(
      { cx: Number(match[1]), cy: Number(match[2]) },
      spec.successCheck,
      "es",
    );
  } catch {
    return null;
  }
}

export function oriKidsFreeWorld(project: StoredProject): WorldStateInput | null {
  return oriKidsFreeMission(project)?.starterStage ?? null;
}
