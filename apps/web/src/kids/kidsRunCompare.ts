import type { Statement } from "@agorix/program-model";
import type { MultiActorRunResult, MultiActorTraceEntry } from "@agorix/runtime";

/** What one run did at the step where the two stopped agreeing. */
export interface StepSide {
  readonly statementType: Statement["type"];
  readonly actorId: string;
  readonly x: number;
  readonly y: number;
}

export type Divergence =
  /** Same blocks, same worlds, all the way: the two runs are the same. */
  | { readonly kind: "same"; readonly steps: number }
  /** One run has steps the other does not, after agreeing on all of the shorter one. */
  | {
      readonly kind: "longer";
      readonly index: number;
      readonly before: number;
      readonly after: number;
    }
  /** The first step where they differ. `index` is where to look in both runs. */
  | {
      readonly kind: "differs";
      readonly index: number;
      readonly what: "block" | "position" | "value";
      readonly before: StepSide;
      readonly after: StepSide;
    };

const sideOf = (entry: MultiActorTraceEntry): StepSide => ({
  statementType: entry.statementType,
  actorId: entry.actorId,
  x: Math.round(entry.worldAfter.sprite.x),
  y: Math.round(entry.worldAfter.sprite.y),
});

const valuesOf = (entry: MultiActorTraceEntry): string =>
  JSON.stringify([entry.worldAfter.variables, entry.worldAfter.texts, entry.worldAfter.lists]);

/**
 * The first step where two runs of a scene stop agreeing, read from their traces only: the kind of
 * block, where the character ended up, and the values it holds. Nothing is guessed. `before` is
 * the earlier run (for example, before an edit) and `after` the one just made.
 */
export function firstDivergence(
  before: MultiActorRunResult,
  after: MultiActorRunResult,
): Divergence {
  const shared = Math.min(before.trace.length, after.trace.length);
  for (let index = 0; index < shared; index += 1) {
    const a = before.trace[index]!;
    const b = after.trace[index]!;
    const what: "block" | "position" | "value" | undefined =
      a.statementType !== b.statementType || a.actorId !== b.actorId
        ? "block"
        : a.worldAfter.sprite.x !== b.worldAfter.sprite.x ||
            a.worldAfter.sprite.y !== b.worldAfter.sprite.y
          ? "position"
          : valuesOf(a) !== valuesOf(b)
            ? "value"
            : undefined;
    if (what !== undefined)
      return { kind: "differs", index, what, before: sideOf(a), after: sideOf(b) };
  }
  if (before.trace.length !== after.trace.length)
    return {
      kind: "longer",
      index: shared,
      before: before.trace.length,
      after: after.trace.length,
    };
  return { kind: "same", steps: shared };
}
