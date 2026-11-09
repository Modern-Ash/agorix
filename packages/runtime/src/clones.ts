import type { CopyRule, ProjectProgram } from "@agorix/program-model";
import { COPIES_CAP, createCopiesWorld, liveCopies } from "./copies.js";
import { cloneWorldState, createWorldState } from "./world.js";
import type { RuntimeActorMutable } from "./multiActor.js";

/**
 * Copies with a script of their own (issue #1311): a run-only character born from "make copies
 * that run their own script". Its id is the character's id and a counter of the run, so the same
 * inputs make the same run and a replay rebuilds it exactly.
 */
const CLONE_MARK = "#";

export function isCloneId(id: string): boolean {
  return id.includes(CLONE_MARK);
}

/** The character a copy descends from: the id before the first mark. */
export function cloneRootId(id: string): string {
  const at = id.indexOf(CLONE_MARK);
  return at < 0 ? id : id.slice(0, at);
}

export function liveClones(actors: readonly RuntimeActorMutable[]): number {
  return actors.filter((actor) => isCloneId(actor.id)).length;
}

/** How many more copies of either kind the run can hold: the cap is shared. */
export function copyRoom(actors: readonly RuntimeActorMutable[]): number {
  return Math.max(
    0,
    COPIES_CAP - liveCopies(actors.map((actor) => actor.world)) - liveClones(actors),
  );
}

/** The scripts a copy of this character starts with: its parent's, and the copy hat's. */
function copyScriptIds(
  program: ProjectProgram,
  parent: RuntimeActorMutable,
): readonly string[] | undefined {
  if (parent.scriptIds === undefined) return undefined;
  const own = new Set(parent.scriptIds);
  const hats = program.scripts
    .filter(
      (script) =>
        script.trigger.type === "onCloneStart" &&
        [...own].some((id) => script.id === `${id}-clone`),
    )
    .map((script) => script.id);
  // A copy of a copy runs the same scripts as the character it descends from.
  return [...parent.scriptIds, ...hats.filter((id) => !own.has(id))];
}

/** The new characters for `count` copies of `parent`, placed by `rule`; ids come from `counter`. */
export function makeClones(
  program: ProjectProgram,
  parent: RuntimeActorMutable,
  count: number,
  rule: CopyRule,
  nextCounter: () => number,
): RuntimeActorMutable[] {
  const placed = createCopiesWorld(
    createWorldState({ sprite: parent.world.sprite }),
    count,
    rule,
    count,
  ).copies;
  const scriptIds = copyScriptIds(program, parent);
  return Array.from({ length: count }, (_unused, slot) => {
    const world = cloneWorldState(parent.world);
    const at = placed?.[slot];
    const born = createWorldState({
      ...world,
      copies: [],
      sprite: {
        ...world.sprite,
        ...(at === undefined ? {} : { x: at.x, y: at.y }),
      },
    });
    return {
      id: `${cloneRootId(parent.id)}${CLONE_MARK}${nextCounter()}`,
      name: parent.name,
      world: born,
      visible: born.sprite.visible ?? parent.visible,
      size: born.sprite.size ?? parent.size,
      ...(born.sprite.costumeId === undefined ? {} : { costumeId: born.sprite.costumeId }),
      ...(scriptIds === undefined ? {} : { scriptIds }),
    };
  });
}
