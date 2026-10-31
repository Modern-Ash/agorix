import type { ProjectSceneGoal } from "@agorix/persistence";
import type { ProjectProgram } from "@agorix/program-model";
import type { Locale } from "../i18n.js";
import { sceneGoalChoices } from "./kidsSceneGoal.js";
import { actorOfScript, studioActorId } from "./kidsStudioModel.js";

export interface SceneGoalProposal {
  readonly goal: ProjectSceneGoal;
  readonly message: string;
}

/** Characters whose script already moves them: a goal about them is one the child can work toward. */
function movers(program: ProjectProgram): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const script of program.scripts) {
    const actor = actorOfScript(script.id);
    if (actor === null) continue;
    if (
      script.statements.some(
        (statement) => statement.type === "move" || statement.type === "glideTo",
      )
    )
      ids.add(studioActorId(actor.index, actor.characterId));
  }
  return ids;
}

/**
 * Ori's goal ideas, best first, for this cast and this program. Local and deterministic: the goal
 * is one of the closed choices the child could pick alone, so nothing is invented or sent anywhere.
 */
export function rankSceneGoals(
  actorIds: readonly string[],
  program: ProjectProgram,
): readonly ProjectSceneGoal[] {
  const moving = movers(program);
  const score = (goal: ProjectSceneGoal): number => {
    const seeker = moving.has(goal.actorId) ? 2 : 0;
    // With company in the scene a meeting is the richer idea; alone, the edge is the only one.
    const kind = goal.kind === "touchActor" ? 1 : 0;
    return seeker + kind;
  };
  return sceneGoalChoices(actorIds)
    .map((goal, index) => ({ goal, index }))
    .sort((a, b) => score(b.goal) - score(a.goal) || a.index - b.index)
    .map((item) => item.goal);
}

/** The `attempt`-th idea (0 first); it wraps, so "Otra vez" always has something to show. */
export function proposeSceneGoal(
  actors: readonly { readonly id: string; readonly name: string }[],
  program: ProjectProgram,
  locale: Locale,
  attempt: number,
): SceneGoalProposal | null {
  const ranked = rankSceneGoals(
    actors.map((item) => item.id),
    program,
  );
  if (ranked.length === 0) return null;
  const goal = ranked[((attempt % ranked.length) + ranked.length) % ranked.length]!;
  const nameOf = (actorId: string) => actors.find((item) => item.id === actorId)?.name ?? "?";
  const es = locale === "es";
  const who = nameOf(goal.actorId);
  const message =
    goal.kind === "touchActor"
      ? es
        ? `¿Podés hacer que ${who} toque a ${nameOf(goal.targetId)}?`
        : `Can you make ${who} touch ${nameOf(goal.targetId)}?`
      : es
        ? `¿Podés hacer que ${who} llegue al borde?`
        : `Can you make ${who} reach the edge?`;
  return { goal, message };
}
