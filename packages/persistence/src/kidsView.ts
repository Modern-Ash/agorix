import { PersistenceError } from "./store.js";

export const KIDS_VIEW_WORLDS = ["space", "ocean", "robots", "city"] as const;
export const KIDS_VIEW_AVATARS = ["🦊", "🐼", "🐸", "🦁", "🐨", "🦄"] as const;

export interface KidsProjectView {
  readonly world: (typeof KIDS_VIEW_WORLDS)[number];
  readonly avatar: (typeof KIDS_VIEW_AVATARS)[number];
}

export function validateKidsProjectView(value: unknown): KidsProjectView {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new PersistenceError("SCHEMA_MISMATCH", "portable-project", "kidsView must be an object");
  }
  const record = value as Record<string, unknown>;
  if (
    Object.keys(record).some((key) => key !== "world" && key !== "avatar") ||
    !KIDS_VIEW_WORLDS.includes(record.world as KidsProjectView["world"]) ||
    !KIDS_VIEW_AVATARS.includes(record.avatar as KidsProjectView["avatar"])
  ) {
    throw new PersistenceError("SCHEMA_MISMATCH", "portable-project", "kidsView is invalid");
  }
  return {
    world: record.world as KidsProjectView["world"],
    avatar: record.avatar as KidsProjectView["avatar"],
  };
}
