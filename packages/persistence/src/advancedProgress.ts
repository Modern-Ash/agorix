import { PersistenceError } from "./store.js";

export const ADVANCED_PROGRESS_SCHEMA = "agorix/kids-advanced-progress/v1";
export type AdvancedStageId = "scene" | "react" | "score";

export interface AdvancedProgressRecord {
  readonly schema: typeof ADVANCED_PROGRESS_SCHEMA;
  readonly stage: AdvancedStageId;
  readonly completed: boolean;
}

export function validateAdvancedProgress(input: unknown): AdvancedProgressRecord {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new PersistenceError("SCHEMA_MISMATCH", "advanced-progress", "invalid progress record");
  }
  const value = input as Record<string, unknown>;
  if (
    Object.keys(value).some((key) => !["schema", "stage", "completed"].includes(key)) ||
    value.schema !== ADVANCED_PROGRESS_SCHEMA ||
    !["scene", "react", "score"].includes(String(value.stage)) ||
    typeof value.completed !== "boolean"
  ) {
    throw new PersistenceError("SCHEMA_MISMATCH", "advanced-progress", "invalid progress record");
  }
  return value as unknown as AdvancedProgressRecord;
}
