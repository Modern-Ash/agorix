import type { ProjectProgram, Statement } from "@agorix/program-model";
import type { MultiActorRunResult } from "@agorix/runtime";

/** One value that changed during a run, and the block that changed it. */
export interface ValueChange {
  /** Index into the run's trace (and frames): where to jump to see it happen. */
  readonly traceIndex: number;
  readonly actorId: string;
  readonly variableId: string;
  readonly name: string;
  readonly from: number | string;
  readonly to: number | string;
  /** The block that did it, in the canonical node-id form, and its kind. */
  readonly nodeId: string;
  readonly statementType: Statement["type"];
}

/** Blocks whose own step spans the blocks inside them, which are traced one by one. */
const CONTAINERS: ReadonlySet<string> = new Set([
  "repeat",
  "repeatUntil",
  "forever",
  "if",
  "callProcedure",
]);

/** The most changes kept; a loop that counts to a thousand must not fill the screen. */
export const VALUE_CHANGES_MAX = 60;

/**
 * Every number and word variable the run changed, in order, each with the block that changed it.
 * It reads only the run's own trace, so it is the same proof the runtime gives: nothing is guessed.
 * Past `VALUE_CHANGES_MAX` the earliest changes are kept and `more` counts the rest.
 */
export function valueHistory(
  program: ProjectProgram,
  run: MultiActorRunResult,
  limit = VALUE_CHANGES_MAX,
): { readonly changes: readonly ValueChange[]; readonly more: number } {
  const names = new Map<string, string>();
  for (const item of program.variables ?? []) names.set(item.id, item.name);
  for (const item of program.textVariables ?? []) names.set(item.id, item.name);
  const changes: ValueChange[] = [];
  let more = 0;
  run.trace.forEach((entry, traceIndex) => {
    if (CONTAINERS.has(entry.statementType)) return;
    const pairs: [string, number | string | undefined, number | string | undefined][] = [];
    const before = entry.worldBefore;
    const after = entry.worldAfter;
    for (const id of Object.keys(after.variables ?? {}))
      pairs.push([id, before.variables?.[id]?.value, after.variables?.[id]?.value]);
    for (const id of Object.keys(after.texts ?? {}))
      pairs.push([id, before.texts?.[id]?.value, after.texts?.[id]?.value]);
    for (const [variableId, from, to] of pairs) {
      if (from === undefined || to === undefined || from === to) continue;
      if (changes.length >= limit) {
        more += 1;
        continue;
      }
      changes.push({
        traceIndex,
        actorId: entry.actorId,
        variableId,
        name: names.get(variableId) ?? variableId,
        from,
        to,
        nodeId: entry.nodeId,
        statementType: entry.statementType,
      });
    }
  });
  return { changes, more };
}

/** The last change to a variable at or before a step: "why does it have this value now". */
export function lastChangeBefore(
  changes: readonly ValueChange[],
  variableId: string,
  traceIndex: number,
): ValueChange | undefined {
  let found: ValueChange | undefined;
  for (const change of changes) {
    if (change.variableId !== variableId || change.traceIndex > traceIndex) continue;
    found = change;
  }
  return found;
}
