import { KIDS_MISSION_IDS, getKidsMission, worldToCell } from "@agorix/curriculum";
import { ProjectStore } from "@agorix/persistence";
import type { Locale } from "../i18n.js";
import type { KidsAvatar, KidsWorld } from "./kidsState.js";
import {
  createStudioProject,
  deleteStudioProject,
  setStudioSceneGoal,
  studioSceneGoal,
} from "./kidsStudioProjects.js";
import type { KidsGalleryBackdropId, KidsGalleryCharacterId } from "./kidsGallery.js";

const KEY = "agorix.kids.missionScenes.v1";
const CHARACTER: Record<KidsAvatar, KidsGalleryCharacterId> = {
  "🦊": "mika",
  "🐼": "pip",
  "🐸": "tito",
  "🦁": "mika",
  "🐨": "pip",
  "🦄": "luma",
};
const BACKDROP: Record<KidsWorld, KidsGalleryBackdropId> = {
  space: "galaxy",
  ocean: "reef",
  robots: "lab",
  city: "castle",
};

type Storage = Pick<globalThis.Storage, "getItem" | "setItem">;

function browserStorage(): Storage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

function savedScenes(storage: Storage): Record<string, string> {
  try {
    const value: unknown = JSON.parse(storage.getItem(KEY) ?? "{}");
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(
      Object.entries(value).filter(
        (entry): entry is [string, string] =>
          /^kids\.(space|ocean|robots|city)\.kids\.m[1-3]\./.test(entry[0]) &&
          typeof entry[1] === "string" &&
          /^studio-[1-9][0-9]*$/.test(entry[1]),
      ),
    );
  } catch {
    return {};
  }
}

/** Resolves a scene back to its Map mission so Projects and deep links keep the goal context. */
export function missionOfStudio(
  studioId: string,
  storage: Storage | undefined = browserStorage(),
): { readonly world: KidsWorld; readonly index: 0 | 1 | 2 } | null {
  if (!storage) return null;
  const scenes = savedScenes(storage);
  for (const world of ["space", "ocean", "robots", "city"] as const) {
    for (const index of [0, 1, 2] as const) {
      if (scenes[`kids.${world}.${KIDS_MISSION_IDS[index]}`] === studioId) return { world, index };
    }
  }
  return null;
}

/** One canonical creative scene per world and mission. */
export function ensureMissionStudio(
  world: KidsWorld,
  missionIndex: 0 | 1 | 2,
  avatar: KidsAvatar,
  locale: Locale,
  store: ProjectStore = new ProjectStore(),
  storage: Storage | undefined = browserStorage(),
): string | null {
  if (!storage) return null;
  const mission = getKidsMission(KIDS_MISSION_IDS[missionIndex], locale, world);
  const startX = mission.starterStage.sprite?.x;
  const startY = mission.starterStage.sprite?.y;
  const goalX = mission.starterStage.goal?.x;
  const goalY = mission.starterStage.goal?.y;
  if (
    typeof startX !== "number" ||
    typeof startY !== "number" ||
    typeof goalX !== "number" ||
    typeof goalY !== "number"
  )
    return null;
  const sceneKey = `kids.${world}.${mission.id}`;
  const known = savedScenes(storage);
  if (known[sceneKey] && store.has(known[sceneKey])) {
    try {
      const sceneId = known[sceneKey];
      const actorId = store.load(sceneId).metadata.actors?.items[0]?.id;
      if (!actorId) return null;
      const expected = {
        kind: "reachCell" as const,
        actorId,
        ...worldToCell({ x: goalX, y: goalY }),
        ...(missionIndex === 2 ? { afterTurn: true } : {}),
      };
      if (JSON.stringify(studioSceneGoal(sceneId, store)) !== JSON.stringify(expected))
        setStudioSceneGoal(sceneId, expected, store);
      return sceneId;
    } catch {
      return null;
    }
  }

  const character = CHARACTER[avatar];
  const actorId = `actor:studio-1-${character}`;

  const scene = createStudioProject(character, BACKDROP[world], locale, store, storage);
  try {
    const saved = store.load(scene.id);
    store.save(scene.id, saved.program, {
      ...saved.metadata,
      actors: {
        activeId: actorId,
        items: saved.metadata.actors!.items.map((actor) =>
          actor.id === actorId ? { ...actor, x: startX, y: startY } : actor,
        ),
      },
    });
    const goal = worldToCell({ x: goalX, y: goalY });
    setStudioSceneGoal(
      scene.id,
      { kind: "reachCell", actorId, ...goal, ...(missionIndex === 2 ? { afterTurn: true } : {}) },
      store,
    );
    storage.setItem(KEY, JSON.stringify({ ...known, [sceneKey]: scene.id }));
    return scene.id;
  } catch {
    deleteStudioProject(scene.id, store, storage);
    return null;
  }
}
