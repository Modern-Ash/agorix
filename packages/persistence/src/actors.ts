import { PersistenceError } from "./store.js";

export const ACTOR_NAME_MAX_LENGTH = 40;
export const ACTOR_MAX_COUNT = 16;
export const ACTOR_COORDINATE_LIMIT = 10_000;
export const ACTOR_SIZE_MIN = 5;
export const ACTOR_SIZE_MAX = 500;

const ACTOR_KEYS = ["id", "name", "x", "y", "direction", "size", "visible", "costume"] as const;
const ACTOR_SET_KEYS = ["activeId", "items", "backdrop", "sounds"] as const;
export const ACTOR_SOUND_MAX_COUNT = 16;
const ASSET_ID = /^[a-z][a-z0-9-]{0,31}$/;
const ACTOR_ID = /^[a-z][a-z0-9-]{0,31}$/;

/** Starting properties of a Scratch-like actor (sprite). Scripts will attach to actors later. */
export interface ProjectActor {
  readonly id: string;
  readonly name: string;
  readonly x: number;
  readonly y: number;
  /** Degrees, 0 ≤ direction < 360. Same convention as the runtime heading. */
  readonly direction: number;
  /** Percent of the default sprite size. */
  readonly size: number;
  readonly visible: boolean;
  /** Id of a built-in library visual (apps/web assetLibrary); absent means the world default. */
  readonly costume?: string;
}

export interface ProjectActors {
  readonly activeId: string;
  readonly items: readonly ProjectActor[];
  /** Id of a built-in library backdrop; absent means the world default. */
  readonly backdrop?: string;
  /** Ids of built-in library sounds attached to the project (playback blocks come later). */
  readonly sounds?: readonly string[];
}

function fail(message: string): never {
  throw new PersistenceError("SCHEMA_MISMATCH", "project-actors", message);
}

function finite(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) fail(`${path} must be a finite number`);
  return value;
}

export function validateProjectActors(input: unknown): ProjectActors {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    fail("metadata.actors must be an object");
  }
  const record = input as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!(ACTOR_SET_KEYS as readonly string[]).includes(key)) {
      throw new PersistenceError(
        "FORBIDDEN_FIELD",
        "project-actors",
        `field metadata.actors.${key} is not part of .agorix v1`,
      );
    }
  }
  const items = record["items"];
  if (!Array.isArray(items) || items.length < 1 || items.length > ACTOR_MAX_COUNT) {
    fail(`metadata.actors.items must hold 1-${ACTOR_MAX_COUNT} actors`);
  }
  const seen = new Set<string>();
  const actors = items.map((item, index): ProjectActor => {
    const path = `metadata.actors.items[${index}]`;
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      fail(`${path} must be an object`);
    }
    const actor = item as Record<string, unknown>;
    for (const key of Object.keys(actor)) {
      if (!(ACTOR_KEYS as readonly string[]).includes(key)) {
        throw new PersistenceError(
          "FORBIDDEN_FIELD",
          "project-actors",
          `field ${path}.${key} is not part of .agorix v1`,
        );
      }
    }
    const id = actor["id"];
    if (typeof id !== "string" || !ACTOR_ID.test(id) || seen.has(id)) {
      fail(`${path}.id must be a unique stable identifier`);
    }
    seen.add(id);
    const name = actor["name"];
    if (
      typeof name !== "string" ||
      name.trim().length < 1 ||
      name.length > ACTOR_NAME_MAX_LENGTH ||
      [...name].some((char) => char.charCodeAt(0) <= 0x1f || char.charCodeAt(0) === 0x7f)
    ) {
      fail(`${path}.name must be 1-${ACTOR_NAME_MAX_LENGTH} printable characters`);
    }
    const x = finite(actor["x"], `${path}.x`);
    const y = finite(actor["y"], `${path}.y`);
    if (Math.abs(x) > ACTOR_COORDINATE_LIMIT || Math.abs(y) > ACTOR_COORDINATE_LIMIT) {
      fail(`${path} position is out of range`);
    }
    const direction = finite(actor["direction"], `${path}.direction`);
    if (direction < 0 || direction >= 360) fail(`${path}.direction must be in [0, 360)`);
    const size = finite(actor["size"], `${path}.size`);
    if (size < ACTOR_SIZE_MIN || size > ACTOR_SIZE_MAX) fail(`${path}.size is out of range`);
    if (typeof actor["visible"] !== "boolean") fail(`${path}.visible must be a boolean`);
    const costume = actor["costume"];
    if (costume !== undefined && (typeof costume !== "string" || !ASSET_ID.test(costume))) {
      fail(`${path}.costume must be a library asset id`);
    }
    return {
      id,
      name,
      x,
      y,
      direction,
      size,
      visible: actor["visible"],
      ...(costume === undefined ? {} : { costume }),
    };
  });
  const activeId = record["activeId"];
  if (typeof activeId !== "string" || !seen.has(activeId)) {
    fail("metadata.actors.activeId must name an existing actor");
  }
  const backdrop = record["backdrop"];
  if (backdrop !== undefined && (typeof backdrop !== "string" || !ASSET_ID.test(backdrop))) {
    fail("metadata.actors.backdrop must be a library asset id");
  }
  const sounds = record["sounds"];
  if (
    sounds !== undefined &&
    (!Array.isArray(sounds) ||
      sounds.length > ACTOR_SOUND_MAX_COUNT ||
      new Set(sounds).size !== sounds.length ||
      sounds.some((sound) => typeof sound !== "string" || !ASSET_ID.test(sound)))
  ) {
    fail(`metadata.actors.sounds must hold up to ${ACTOR_SOUND_MAX_COUNT} unique library ids`);
  }
  return {
    activeId,
    items: actors,
    ...(backdrop === undefined ? {} : { backdrop }),
    ...(sounds === undefined ? {} : { sounds: sounds as string[] }),
  };
}

// ---- Pure editing helpers shared by Web and Studio ----

/** `costume: null` clears the choice and goes back to the world default. */
export type ActorPatch = Partial<Omit<ProjectActor, "id" | "costume">> & {
  costume?: string | null;
};

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

export function toggleSound(actors: ProjectActors, id: string): ProjectActors {
  const current = actors.sounds ?? [];
  const sounds = current.includes(id)
    ? current.filter((sound) => sound !== id)
    : [...current, id].slice(0, ACTOR_SOUND_MAX_COUNT);
  const next: { -readonly [K in keyof ProjectActors]: ProjectActors[K] } = { ...actors };
  if (sounds.length === 0) delete next.sounds;
  else next.sounds = sounds;
  return next;
}

export function withBackdrop(actors: ProjectActors, id: string): ProjectActors {
  const next: { -readonly [K in keyof ProjectActors]: ProjectActors[K] } = { ...actors };
  if (id === "") delete next.backdrop;
  else next.backdrop = id;
  return next;
}
