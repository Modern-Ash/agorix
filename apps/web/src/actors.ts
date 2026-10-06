import {
  ACTOR_NAME_MAX_LENGTH,
  ACTOR_SIZE_MAX,
  ACTOR_SIZE_MIN,
  ACTOR_COORDINATE_LIMIT,
  type ProjectActor,
  type ProjectActors,
} from "@agorix/persistence";
import { createStageSession, type StageSession } from "@agorix/stage";

export const DEFAULT_ACTOR_ID = "sprite";
export const BASE_SPRITE_RADIUS = 12;

/** `costume: null` clears the choice and goes back to the world default. */
export type ActorPatch = Partial<Omit<ProjectActor, "id" | "costume">> & {
  costume?: string | null;
};

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
      },
    ],
  };
}

export function activeActor(actors: ProjectActors): ProjectActor {
  return actors.items.find((item) => item.id === actors.activeId) ?? actors.items[0]!;
}

function stripControlCharacters(value: string): string {
  return [...value]
    .filter((char) => char.charCodeAt(0) > 0x1f && char.charCodeAt(0) !== 0x7f)
    .join("");
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Normalizes an edit so the stored actor always satisfies the persisted contract. */
export function sanitizeActor(actor: ProjectActor): ProjectActor {
  const direction = ((actor.direction % 360) + 360) % 360;
  const name = stripControlCharacters(actor.name).slice(0, ACTOR_NAME_MAX_LENGTH);
  return {
    ...actor,
    name: name.trim() === "" ? "Sprite" : name,
    x: clamp(actor.x, -ACTOR_COORDINATE_LIMIT, ACTOR_COORDINATE_LIMIT),
    y: clamp(actor.y, -ACTOR_COORDINATE_LIMIT, ACTOR_COORDINATE_LIMIT),
    direction: Object.is(direction, -0) ? 0 : direction,
    size: clamp(actor.size, ACTOR_SIZE_MIN, ACTOR_SIZE_MAX),
  };
}

export function patchActive(actors: ProjectActors, patch: ActorPatch): ProjectActors {
  return {
    ...actors,
    items: actors.items.map((item) => {
      if (item.id !== actors.activeId) return item;
      const { costume, ...rest } = patch;
      const base: { -readonly [K in keyof ProjectActor]?: ProjectActor[K] } = { ...item };
      delete base.costume;
      const next = costume === undefined ? item.costume : (costume ?? undefined);
      return sanitizeActor({
        ...(base as ProjectActor),
        ...rest,
        ...(next === undefined ? {} : { costume: next }),
      });
    }),
  };
}

export function withBackdrop(actors: ProjectActors, id: string): ProjectActors {
  const next: { -readonly [K in keyof ProjectActors]: ProjectActors[K] } = { ...actors };
  if (id === "") delete next.backdrop;
  else next.backdrop = id;
  return next;
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
