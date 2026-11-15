import type { ProjectSceneGoal } from "@agorix/persistence";
import type { MultiActorRunResult } from "@agorix/runtime";
import { worldToCell } from "@agorix/curriculum";
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

/** A goal about a character; one about a value has no character. */
export type ActorSceneGoal = Exclude<ProjectSceneGoal, { readonly kind: "variableReaches" }>;

function metIn(goal: ActorSceneGoal, actors: readonly Placed[]): boolean {
  const find = (id: string) => actors.find((item) => item.id === id);
  if (goal.kind === "touchActor") return touching(find(goal.actorId), find(goal.targetId));
  if (goal.kind === "reachEdge") return atEdge(find(goal.actorId));
  const actor = find(goal.actorId);
  if (!actor || !actor.visible) return false;
  const cell = worldToCell(actor.world.sprite);
  return cell.cx === goal.cx && cell.cy === goal.cy;
}

function reachedCellInTrace(
  goal: Extract<ProjectSceneGoal, { kind: "reachCell" }>,
  run: MultiActorRunResult,
): boolean {
  let turned = false;
  for (const step of run.trace ?? []) {
    if (step.actorId !== goal.actorId) continue;
    if (step.statementType === "turn") turned = true;
    if (goal.afterTurn && !turned) continue;
    const from = worldToCell(step.worldBefore.sprite);
    const to = worldToCell(step.worldAfter.sprite);
    const dx = Math.sign(to.cx - from.cx);
    const dy = Math.sign(to.cy - from.cy);
    if (dx !== 0 && dy !== 0) {
      if (to.cx === goal.cx && to.cy === goal.cy) return true;
      continue;
    }
    let cursor = from;
    while (cursor.cx !== to.cx || cursor.cy !== to.cy) {
      cursor = { cx: cursor.cx + dx, cy: cursor.cy + dy };
      if (cursor.cx === goal.cx && cursor.cy === goal.cy) return true;
    }
  }
  return false;
}

/**
 * A goal counts when a step of the run reaches it. The starting layout is not a step, so a goal
 * that is already true before anything runs is not met by running an empty program.
 */
export function sceneGoalMet(goal: ProjectSceneGoal, run: MultiActorRunResult): boolean {
  if (goal.kind === "variableReaches") {
    // A value held at the end of any step counts, even if a later block took it back down.
    const held = (variables: Readonly<Record<string, { readonly value: number }>> | undefined) =>
      (variables?.[goal.variableId]?.value ?? Number.NEGATIVE_INFINITY) >= goal.value;
    return (
      held(run.stage.variables) ||
      run.frames.some(
        (frame) =>
          held(frame.stage.variables) || frame.actors.some((actor) => held(actor.world.variables)),
      )
    );
  }
  if (goal.kind === "reachCell") {
    if ((run.trace?.length ?? 0) > 0) return reachedCellInTrace(goal, run);
    // A one-frame run is only the starting layout; a later frame is evidence of a step.
    return !goal.afterTurn && run.frames.slice(1).some((frame) => metIn(goal, frame.actors));
  }
  return run.frames.some((frame) => metIn(goal, frame.actors));
}

/** Both characters of a goal must still be in the scene. */
export function sceneGoalValid(
  goal: ProjectSceneGoal,
  actorIds: readonly string[],
  /** The scene's number variables; a goal about a value needs its variable to still exist. */
  variableIds?: readonly string[],
): boolean {
  if (goal.kind === "variableReaches")
    return variableIds === undefined || variableIds.includes(goal.variableId);
  return goal.kind === "touchActor"
    ? actorIds.includes(goal.actorId) && actorIds.includes(goal.targetId)
    : actorIds.includes(goal.actorId);
}

/** The goals a child can pick for the current cast: one edge goal per character, one touch per pair. */
export function sceneGoalChoices(actorIds: readonly string[]): readonly ActorSceneGoal[] {
  const edges = actorIds.map((actorId) => ({ kind: "reachEdge", actorId }) as const);
  const touches = actorIds.flatMap((actorId) =>
    actorIds
      .filter((targetId) => targetId !== actorId)
      .map((targetId) => ({ kind: "touchActor", actorId, targetId }) as const),
  );
  return [...touches, ...edges];
}

/** Reaching a number a score game aims for: one choice per number variable and target. */
export const VARIABLE_GOAL_VALUES = [3, 5, 10] as const;

export function variableGoalChoices(
  variables: readonly { readonly id: string }[],
): readonly ProjectSceneGoal[] {
  return variables.flatMap((variable) =>
    VARIABLE_GOAL_VALUES.map(
      (value) => ({ kind: "variableReaches", variableId: variable.id, value }) as const,
    ),
  );
}

export function describeSceneGoal(
  goal: ProjectSceneGoal,
  nameOf: (actorId: string) => string,
  locale: Locale,
  /** Names of the scene's number variables, for a goal about a value. */
  variableName: (variableId: string) => string = (variableId) => variableId,
): string {
  const es = locale === "es";
  if (goal.kind === "variableReaches") {
    return es
      ? `${variableName(goal.variableId)} llega a ${goal.value}`
      : `${variableName(goal.variableId)} reaches ${goal.value}`;
  }
  if (goal.kind === "reachEdge") {
    return es
      ? `${nameOf(goal.actorId)} llega al borde`
      : `${nameOf(goal.actorId)} reaches the edge`;
  }
  if (goal.kind === "reachCell") {
    return es
      ? `${nameOf(goal.actorId)} llega a columna ${goal.cx + 1}, fila ${goal.cy + 1}${goal.afterTurn ? " después de girar" : ""}`
      : `${nameOf(goal.actorId)} reaches column ${goal.cx + 1}, row ${goal.cy + 1}${goal.afterTurn ? " after turning" : ""}`;
  }
  return es
    ? `${nameOf(goal.actorId)} toca a ${nameOf(goal.targetId)}`
    : `${nameOf(goal.actorId)} touches ${nameOf(goal.targetId)}`;
}

export function sceneGoalKey(goal: ProjectSceneGoal): string {
  if (goal.kind === "variableReaches") return `value:${goal.variableId}:${goal.value}`;
  if (goal.kind === "touchActor") return `touch:${goal.actorId}:${goal.targetId}`;
  if (goal.kind === "reachCell") {
    return `cell:${goal.actorId}:${goal.cx}:${goal.cy}${goal.afterTurn ? ":turn" : ""}`;
  }
  return `edge:${goal.actorId}`;
}
