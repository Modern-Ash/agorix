import type { GoToLayerStatement } from "@agorix/program-model";

/** The new stage order (last is in front) after a character goes to, or moves through, a layer. */
export function reorderActors(
  order: readonly string[],
  actorId: string,
  statement: GoToLayerStatement,
): string[] {
  const rest = order.filter((id) => id !== actorId);
  if (statement.layer === "front") return [...rest, actorId];
  if (statement.layer === "back") return [actorId, ...rest];
  const at = order.indexOf(actorId);
  if (at < 0) return [...order];
  const steps = statement.steps ?? 1;
  const to = Math.max(
    0,
    Math.min(rest.length, statement.layer === "forward" ? at + steps : at - steps),
  );
  return [...rest.slice(0, to), actorId, ...rest.slice(to)];
}
