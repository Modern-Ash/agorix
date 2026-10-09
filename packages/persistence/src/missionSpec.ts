import { PersistenceError } from "./store.js";

export const MISSION_SPEC_GOAL_MAX_LENGTH = 140;
export const MISSION_SPEC_PREDICTION_PROMPT_MAX_LENGTH = 160;
export const MISSION_SPEC_SUCCESS_CHECKS = ["touches-goal"] as const;

export type MissionSpecSuccessCheck = (typeof MISSION_SPEC_SUCCESS_CHECKS)[number];

export interface ProjectMissionSpec {
  readonly goal: string;
  readonly successCheck: MissionSpecSuccessCheck;
  readonly predictionPrompt?: string;
}

const PORTABLE_PROJECT_ID = "portable-project";

export function validateProjectMissionSpec(input: unknown): ProjectMissionSpec {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new PersistenceError(
      "SCHEMA_MISMATCH",
      PORTABLE_PROJECT_ID,
      "missionSpec must be an object",
    );
  }
  const spec = input as Record<string, unknown>;
  assertAllowedKeys(spec);
  const goal = boundedText(spec["goal"], 1, MISSION_SPEC_GOAL_MAX_LENGTH, "goal");
  const successCheck = spec["successCheck"];
  if (!MISSION_SPEC_SUCCESS_CHECKS.includes(successCheck as MissionSpecSuccessCheck)) {
    throw new PersistenceError(
      "SCHEMA_MISMATCH",
      PORTABLE_PROJECT_ID,
      "missionSpec.successCheck must be a supported runtime check",
    );
  }
  const predictionPrompt =
    spec["predictionPrompt"] === undefined
      ? undefined
      : boundedText(
          spec["predictionPrompt"],
          1,
          MISSION_SPEC_PREDICTION_PROMPT_MAX_LENGTH,
          "predictionPrompt",
        );
  return {
    goal,
    successCheck: successCheck as MissionSpecSuccessCheck,
    ...(predictionPrompt === undefined ? {} : { predictionPrompt }),
  };
}

export function missionSpecHash(spec: ProjectMissionSpec | undefined): string | undefined {
  if (spec === undefined) return undefined;
  return stableHash(stableStringify(validateProjectMissionSpec(spec)));
}

function assertAllowedKeys(value: Record<string, unknown>): void {
  const allowed = new Set(["goal", "successCheck", "predictionPrompt"]);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      throw new PersistenceError(
        "SCHEMA_MISMATCH",
        PORTABLE_PROJECT_ID,
        `missionSpec.${key} is not supported`,
      );
    }
  }
}

function boundedText(value: unknown, min: number, max: number, field: string): string {
  if (typeof value !== "string") {
    throw new PersistenceError(
      "SCHEMA_MISMATCH",
      PORTABLE_PROJECT_ID,
      `missionSpec.${field} must be a string`,
    );
  }
  const normalized = [...value]
    .map((char) => {
      const code = char.charCodeAt(0);
      return code < 32 || code === 127 ? " " : char;
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
  if (normalized.length < min || normalized.length > max) {
    throw new PersistenceError(
      "SCHEMA_MISMATCH",
      PORTABLE_PROJECT_ID,
      `missionSpec.${field} must be ${min}-${max} characters`,
    );
  }
  if (/[<>`]/.test(normalized) || /\bhttps?:\/\//i.test(normalized)) {
    throw new PersistenceError(
      "SCHEMA_MISMATCH",
      PORTABLE_PROJECT_ID,
      `missionSpec.${field} must be plain text`,
    );
  }
  return normalized;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  if (typeof value === "object" && value !== null) {
    const entries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right));
    return `{${entries
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableStringify(nested)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function stableHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `mission:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}
