import { PersistenceError } from "./store.js";

/**
 * A goal a child sets on a free scene (issue #1121). It names characters by their actor id and is
 * checked against a run, never against free text, so it carries no personal data.
 */
export type ProjectSceneGoal =
  | { readonly kind: "touchActor"; readonly actorId: string; readonly targetId: string }
  | { readonly kind: "reachEdge"; readonly actorId: string }
  | {
      readonly kind: "reachCell";
      readonly actorId: string;
      readonly cx: number;
      readonly cy: number;
      readonly afterTurn?: boolean;
    };

const ACTOR_ID = /^actor:[A-Za-z0-9_-]{1,56}$/;
const PORTABLE_PROJECT_ID = "portable-project";

function invalid(message: string): never {
  throw new PersistenceError("SCHEMA_MISMATCH", PORTABLE_PROJECT_ID, message);
}

function actorId(value: unknown, field: string): string {
  if (typeof value !== "string" || !ACTOR_ID.test(value)) invalid(`sceneGoal.${field} is invalid`);
  return value;
}

export function validateProjectSceneGoal(value: unknown): ProjectSceneGoal {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return invalid("sceneGoal must be an object");
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  if (record["kind"] === "touchActor") {
    if (keys.some((key) => !["kind", "actorId", "targetId"].includes(key))) {
      return invalid("sceneGoal has an unknown field");
    }
    const seeker = actorId(record["actorId"], "actorId");
    const target = actorId(record["targetId"], "targetId");
    if (seeker === target) return invalid("sceneGoal needs two different characters");
    return { kind: "touchActor", actorId: seeker, targetId: target };
  }
  if (record["kind"] === "reachEdge") {
    if (keys.some((key) => !["kind", "actorId"].includes(key))) {
      return invalid("sceneGoal has an unknown field");
    }
    return { kind: "reachEdge", actorId: actorId(record["actorId"], "actorId") };
  }
  if (record["kind"] === "reachCell") {
    if (keys.some((key) => !["kind", "actorId", "cx", "cy", "afterTurn"].includes(key))) {
      return invalid("sceneGoal has an unknown field");
    }
    const cx = record["cx"];
    const cy = record["cy"];
    if (
      !Number.isInteger(cx) ||
      !Number.isInteger(cy) ||
      (cx as number) < 0 ||
      (cx as number) > 5 ||
      (cy as number) < 0 ||
      (cy as number) > 3
    ) {
      return invalid("sceneGoal cell is invalid");
    }
    if (record["afterTurn"] !== undefined && typeof record["afterTurn"] !== "boolean") {
      return invalid("sceneGoal.afterTurn is invalid");
    }
    return {
      kind: "reachCell",
      actorId: actorId(record["actorId"], "actorId"),
      cx: cx as number,
      cy: cy as number,
      ...(record["afterTurn"] === true ? { afterTurn: true } : {}),
    };
  }
  return invalid("sceneGoal.kind is not supported");
}
