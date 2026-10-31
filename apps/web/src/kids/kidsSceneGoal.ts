import type { ProjectSceneGoal } from "@agorix/persistence";
import type { MultiActorRunResult } from "@agorix/runtime";
import type { Locale } from "../i18n.js";
import { STUDIO_EDGE_CONDITION } from "./kidsStudioModel.js";

/** Same geometry as the `touchingActor` and `touchingStageEdge` conditions in the runtime. */
const TOUCH_DISTANCE = 24;
const EDGE_MARGIN = 12;

interface Placed {
  readonly id: string;
  readonly visible: boolean;
  readonly world: { readonly sprite: { readonly x: number; readonly y: number } };
}

function touching(seeker: Placed | undefined, target: Placed | undefined): boolean {
  if (!seeker || !target || !seeker.visible || !target.visible) return false;
  const a = seeker.world.sprite;
  const b = target.world.sprite;
  return Math.hypot(a.x - b.x, a.y - b.y) <= TOUCH_DISTANCE;
}

function atEdge(actor: Placed | undefined): boolean {
  if (!actor || !actor.visible) return false;
  const { x, y } = actor.world.sprite;
  const edge = STUDIO_EDGE_CONDITION;
  return (
    x <= edge.minX + EDGE_MARGIN ||
    x >= edge.maxX - EDGE_MARGIN ||
    y <= edge.minY + EDGE_MARGIN ||
    y >= edge.maxY - EDGE_MARGIN
  );
}

function metIn(goal: ProjectSceneGoal, actors: readonly Placed[]): boolean {
  const find = (id: string) => actors.find((item) => item.id === id);
  return goal.kind === "touchActor"
    ? touching(find(goal.actorId), find(goal.targetId))
    : atEdge(find(goal.actorId));
}

/**
 * A goal counts when a step of the run reaches it. The starting layout is not a step, so a goal
 * that is already true before anything runs is not met by running an empty program.
 */
export function sceneGoalMet(goal: ProjectSceneGoal, run: MultiActorRunResult): boolean {
  return run.frames.some((frame) => metIn(goal, frame.actors));
}

/** Both characters of a goal must still be in the scene. */
export function sceneGoalValid(goal: ProjectSceneGoal, actorIds: readonly string[]): boolean {
  return goal.kind === "touchActor"
    ? actorIds.includes(goal.actorId) && actorIds.includes(goal.targetId)
    : actorIds.includes(goal.actorId);
}

/** The goals a child can pick for the current cast: one edge goal per character, one touch per pair. */
export function sceneGoalChoices(actorIds: readonly string[]): readonly ProjectSceneGoal[] {
  const edges = actorIds.map((actorId) => ({ kind: "reachEdge", actorId }) as const);
  const touches = actorIds.flatMap((actorId) =>
    actorIds
      .filter((targetId) => targetId !== actorId)
      .map((targetId) => ({ kind: "touchActor", actorId, targetId }) as const),
  );
  return [...touches, ...edges];
}

export function describeSceneGoal(
  goal: ProjectSceneGoal,
  nameOf: (actorId: string) => string,
  locale: Locale,
): string {
  const es = locale === "es";
  if (goal.kind === "reachEdge") {
    return es
      ? `${nameOf(goal.actorId)} llega al borde`
      : `${nameOf(goal.actorId)} reaches the edge`;
  }
  return es
    ? `${nameOf(goal.actorId)} toca a ${nameOf(goal.targetId)}`
    : `${nameOf(goal.actorId)} touches ${nameOf(goal.targetId)}`;
}

export function sceneGoalKey(goal: ProjectSceneGoal): string {
  return goal.kind === "touchActor"
    ? `touch:${goal.actorId}:${goal.targetId}`
    : `edge:${goal.actorId}`;
}
