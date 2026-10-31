import type { OriLocale, OriTextModel } from "./index.js";

export const ORI_SCENE_GOAL_VERSION = "agorix/ori-scene-goal/v1";
export const ORI_SCENE_GOAL_MAX_CHOICES = 40;
const ACTOR_ID = /^actor:studio-\d{1,2}-[a-z][a-z0-9-]{0,31}$/;

/** One goal the child could pick alone. Ids are opaque scene ids, never names or free text. */
export type OriSceneGoalChoice =
  | { readonly kind: "reachEdge"; readonly actorId: string }
  | { readonly kind: "touchActor"; readonly actorId: string; readonly targetId: string };

export interface OriSceneGoalDecision {
  readonly source: "model" | "fallback";
  /** Index into the request's choices. The host owns the goal and its wording. */
  readonly choice: number;
}

export function getOriSceneGoalInstructions(): string {
  return `Contract ${ORI_SCENE_GOAL_VERSION}. Pick the single most motivating goal for a child's Agorix scene from the numbered choices. Return one JSON object only: {"version":"${ORI_SCENE_GOAL_VERSION}","choice":<index>}. No free text, links, tools, personal data or extra keys. The child decides whether to accept. The host owns the wording.`;
}

/** Validates a browser-sent choice list; returns null for anything outside the closed shape. */
export function parseOriSceneGoalChoices(value: unknown): readonly OriSceneGoalChoice[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > ORI_SCENE_GOAL_MAX_CHOICES)
    return null;
  const choices: OriSceneGoalChoice[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const entry = item as Record<string, unknown>;
    const keys = Object.keys(entry).sort().join(",");
    if (typeof entry.actorId !== "string" || !ACTOR_ID.test(entry.actorId)) return null;
    if (entry.kind === "reachEdge" && keys === "actorId,kind") {
      choices.push({ kind: "reachEdge", actorId: entry.actorId });
    } else if (
      entry.kind === "touchActor" &&
      keys === "actorId,kind,targetId" &&
      typeof entry.targetId === "string" &&
      ACTOR_ID.test(entry.targetId) &&
      entry.targetId !== entry.actorId
    ) {
      choices.push({ kind: "touchActor", actorId: entry.actorId, targetId: entry.targetId });
    } else return null;
  }
  return choices;
}

export async function runOriSceneGoalAgent(
  locale: OriLocale,
  choices: readonly OriSceneGoalChoice[],
  model?: OriTextModel,
): Promise<OriSceneGoalDecision> {
  const fallback = (): OriSceneGoalDecision => ({ source: "fallback", choice: 0 });
  if (!model || choices.length === 0) return fallback();
  try {
    const raw = await model.generate(
      getOriSceneGoalInstructions(),
      JSON.stringify({
        version: ORI_SCENE_GOAL_VERSION,
        locale,
        choices: choices.map((item, index) => ({ index, ...item })),
      }),
    );
    const value: unknown = typeof raw === "string" && raw.length <= 1024 ? JSON.parse(raw) : raw;
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new Error("invalid scene goal");
    const parsed = value as Record<string, unknown>;
    if (
      Object.keys(parsed).sort().join(",") !== "choice,version" ||
      parsed.version !== ORI_SCENE_GOAL_VERSION ||
      !Number.isInteger(parsed.choice) ||
      (parsed.choice as number) < 0 ||
      (parsed.choice as number) >= choices.length
    )
      throw new Error("invalid scene goal");
    return { source: "model", choice: parsed.choice as number };
  } catch {
    return fallback();
  }
}
