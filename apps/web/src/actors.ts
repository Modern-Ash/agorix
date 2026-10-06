import { activeActor, type ProjectActors } from "@agorix/persistence";
import { DEFAULT_ACTOR_COSTUME } from "./assetLibrary";
import { createStageSession, type StageSession } from "@agorix/stage";

export {
  activeActor,
  patchActive,
  sanitizeActor,
  toggleSound,
  withBackdrop,
  type ActorPatch,
} from "@agorix/persistence";

export const DEFAULT_ACTOR_ID = "sprite";
export const BASE_SPRITE_RADIUS = 12;

export function defaultActors(stage: StageSession): ProjectActors {
  const { sprite } = stage.initial;
  return {
    activeId: DEFAULT_ACTOR_ID,
    items: [
      {
        id: DEFAULT_ACTOR_ID,
        name: "Sprite",
        x: sprite.x,
        y: sprite.y,
        direction: sprite.heading,
        size: 100,
        visible: true,
        costume: DEFAULT_ACTOR_COSTUME,
      },
    ],
  };
}

/** The stage starts from the active actor; the goal keeps the mission's semantics. */
export function stageForActors(stage: StageSession, actors: ProjectActors): StageSession {
  const actor = activeActor(actors);
  return createStageSession({
    sprite: {
      ...stage.initial.sprite,
      x: actor.x,
      y: actor.y,
      heading: actor.direction,
      radius: BASE_SPRITE_RADIUS * (actor.size / 100),
    },
    goal: stage.initial.goal,
    viewport: stage.initial.viewport,
  });
}
