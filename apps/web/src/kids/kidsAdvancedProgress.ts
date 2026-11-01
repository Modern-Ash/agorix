import {
  KIDS_ADVANCED_STAGES,
  KIDS_MISSION_IDS,
  evaluateKidsAdvancedMission,
  getKidsAdvancedMission,
  type KidsAdvancedStage,
} from "@agorix/curriculum";
import {
  ADVANCED_PROGRESS_SCHEMA,
  ProjectStore,
  validateAdvancedProgress,
  type StoredProject,
} from "@agorix/persistence";
import { runMultiActorProgram, type RuntimeEvent } from "@agorix/runtime";
import { KIDS_WORLDS } from "./kidsState.js";
import { validateControlStageProgram } from "./kidsAdvancedControlModel.js";
import { missionSceneCompleted } from "./kidsMissionStudio.js";

/** Check the finished mission scenes, never a star count or legacy profile marker. */
export function advancedEntryUnlocked(store: ProjectStore): boolean {
  return KIDS_MISSION_IDS.every((_missionId, index) =>
    KIDS_WORLDS.some((world) => missionSceneCompleted(world, index as 0 | 1 | 2, store)),
  );
}

export function advancedProjectId(stage: KidsAdvancedStage): string {
  return `kids.advanced.${stage}`;
}

function completed(stage: KidsAdvancedStage, store: ProjectStore): boolean {
  const id = advancedProjectId(stage);
  if (!store.has(id)) return false;
  try {
    const metadata = store.load(id).metadata;
    const record = validateAdvancedProgress(metadata.advancedProgress);
    return record.stage === stage && record.completed && metadata.missionProgress === 1;
  } catch {
    return false;
  }
}

export function advancedStageUnlocked(stage: KidsAdvancedStage, store: ProjectStore): boolean {
  if (!advancedEntryUnlocked(store)) return false;
  const index = KIDS_ADVANCED_STAGES.indexOf(stage);
  if (index < 0) return false;
  return KIDS_ADVANCED_STAGES.slice(0, index).every((prior) => completed(prior, store));
}

export function advancedStageCompleted(stage: KidsAdvancedStage, store: ProjectStore): boolean {
  return advancedStageUnlocked(stage, store) && completed(stage, store);
}

/** Create only an unlocked, canonical stage project; never mutate a prior Kids mission. */
export function ensureAdvancedProject(
  stage: KidsAdvancedStage,
  locale: string,
  store: ProjectStore,
  now = new Date().toISOString(),
): StoredProject | undefined {
  if (!advancedStageUnlocked(stage, store)) return undefined;
  const id = advancedProjectId(stage);
  if (store.has(id)) {
    try {
      return store.load(id);
    } catch {
      return undefined;
    }
  }
  const mission = getKidsAdvancedMission(stage, locale);
  const actors = mission.starterCreative.actors ?? [];
  store.save(id, mission.starterProgram, {
    createdAt: now,
    updatedAt: now,
    missionProgress: 0,
    hintLevel: 0,
    locale,
    actors: { activeId: actors[0]!.id, items: actors },
    ...(mission.starterCreative.stage === undefined
      ? {}
      : { stage: mission.starterCreative.stage }),
    ...(mission.starterCreative.assets === undefined
      ? {}
      : { assets: mission.starterCreative.assets }),
    advancedProgress: { schema: ADVANCED_PROGRESS_SCHEMA, stage, completed: false },
  });
  return store.load(id);
}

/** Run the stored canonical project. Completion cannot be supplied as a caller claim. */
export function completeAdvancedStage(
  stage: KidsAdvancedStage,
  store: ProjectStore,
  childEvent?: RuntimeEvent,
): boolean {
  if (!advancedStageUnlocked(stage, store)) return false;
  const id = advancedProjectId(stage);
  if (!store.has(id)) return false;
  try {
    const project = store.load(id);
    const record = validateAdvancedProgress(project.metadata.advancedProgress);
    if (record.stage !== stage) return false;
    if (record.completed && project.metadata.missionProgress === 1) return true;
    if (stage === "react" && childEvent?.type !== "actorClicked") return false;
    if (stage === "control" || stage === "message")
      validateControlStageProgram(project.program, stage);
    const run = runMultiActorProgram(
      project.program,
      {
        ...(project.metadata.actors === undefined ? {} : { actors: project.metadata.actors.items }),
        ...(project.metadata.stage === undefined ? {} : { stage: project.metadata.stage }),
        ...(project.metadata.assets === undefined ? {} : { assets: project.metadata.assets }),
      },
      {
        ...(childEvent === undefined ? {} : { events: [childEvent] }),
        ...(stage === "control" ? { randomSeed: 42 } : {}),
      },
    );
    if (!evaluateKidsAdvancedMission(stage, run)) return false;
    store.save(id, project.program, {
      ...project.metadata,
      updatedAt: new Date().toISOString(),
      missionProgress: 1,
      advancedProgress: { schema: ADVANCED_PROGRESS_SCHEMA, stage, completed: true },
    });
    return true;
  } catch {
    return false;
  }
}
