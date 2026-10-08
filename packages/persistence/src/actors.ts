import { PersistenceError } from "./store.js";

export const ACTOR_NAME_MAX_LENGTH = 40;
export const ACTOR_MAX_COUNT = 16;
export const ACTOR_COORDINATE_LIMIT = 10_000;
export const ACTOR_SIZE_MIN = 5;
export const ACTOR_SIZE_MAX = 500;

const ACTOR_KEYS = [
  "id",
  "name",
  "x",
  "y",
  "direction",
  "size",
  "visible",
  "costumeId",
  "appearanceId",
  "scripts",
] as const;
const ACTOR_SET_KEYS = ["activeId", "items"] as const;
const ACTOR_ID = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$/;

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
  readonly costumeId?: string;
  /** @deprecated Use costumeId. Kept as a read compatibility alias for pre-core Studio metadata. */
  readonly appearanceId?: string;
  readonly scripts?: readonly string[];
}

export interface ProjectActors {
  readonly activeId: string;
  readonly items: readonly ProjectActor[];
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
    if ("costumeId" in actor && typeof actor["costumeId"] !== "string") {
      fail(`${path}.costumeId must be a string`);
    }
    if ("appearanceId" in actor && typeof actor["appearanceId"] !== "string") {
      fail(`${path}.appearanceId must be a string`);
    }
    if (
      "scripts" in actor &&
      (!Array.isArray(actor["scripts"]) ||
        actor["scripts"].length > 32 ||
        !actor["scripts"].every((script) => typeof script === "string"))
    ) {
      fail(`${path}.scripts must be an array of strings`);
    }
    const costumeId =
      typeof actor["costumeId"] === "string"
        ? actor["costumeId"]
        : typeof actor["appearanceId"] === "string"
          ? actor["appearanceId"]
          : undefined;
    return {
      id,
      name,
      x,
      y,
      direction,
      size,
      visible: actor["visible"],
      ...(costumeId === undefined ? {} : { costumeId }),
      ...(Array.isArray(actor["scripts"]) ? { scripts: actor["scripts"] as readonly string[] } : {}),
    };
  });
  const activeId = record["activeId"];
  if (typeof activeId !== "string" || !seen.has(activeId)) {
    fail("metadata.actors.activeId must name an existing actor");
  }
  return { activeId, items: actors };
}
